"use strict";

const fetch = require("node-fetch");
const fs = require("fs");
const { getXboxAuthToken, getClubData, getXboxUserData, getXboxAccountDataBulk } = require("./xbox.js");
const { realmModel, createRealmDefaults } = require("../database.js");
const { honeypotRealmXUIDs } = require("../data/config.json");

const realm_api_headers = {
	"Accept": "*/*",
	"authorization": "",
	"charset": "utf-8",
	"client-ref": "08bdb049f310d03aeabda3748f857640eb62a733",
	"client-version": "1.20.0",
	"content-type": "application/json",
	"user-agent": "MCPE/UWP",
	"Accept-Language": "en-US",
	"Accept-Encoding": "gzip, deflate, br",
	"Host": "pocket.realms.minecraft.net",
	"Connection": "Keep-Alive"
};

const errorCodes = {
	401: "401 Unauthorized. This is a Realms API bug, please re-run the command",
	404: "Invalid realm code. Maybe try using another realm code",
	429: "Yern has been ratelimited from the Realms API.",
	500: "The realm is currently loading a backup",
	503: "Unable to get the Realms IP. The realm is most likely offline."
};

const api_url = "https://pocket.realms.minecraft.net/";

async function getRealmsAuthToken(accountID) {
	return await getXboxAuthToken(accountID, api_url);
}

async function getRealmData(realmCode, accountID, getExtendedInfo = false) {
	if(realmCode.match(/[^A-Za-z0-9-_=]/)) return {errorMsg: "Invalid link"};

	const authToken = await getRealmsAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	let response;
	if(realmCode.startsWith("=")) {
		if(typeof accountID !== "string") return {errorMsg:"Please link your account with </link:1083907918589595732> to be able to use the Yern ID system."};
		const dbRealm = await realmModel.findOne({cid:realmCode});

		if(!dbRealm) return {errorMsg:"Invalid Yern ID."};

		const allRealms = await getRealmsList(accountID);

		const realm = allRealms.find(({id}) => id === dbRealm.id);
		if(!realm) return {errorMsg:"The realm associated with this Yern ID was not found in your realms list."};

		response = {
			status: 200,
			json: () => {return realm;}
		};
	} else {
		response = await fetch(api_url + `worlds/v1/link/${realmCode}`, {
			method: "GET",
			headers: {
				...realm_api_headers,

				authorization: authToken
			}
		}).catch(() => {});

		if(!response) return {errorMsg:"Unknown"};
	}

	if(response.status !== 200 && response.status !== 403) {
		return {errorMsg: errorCodes[response.status] ?? `${response.status} ${response.statusText} ${await response.text()}`};
	}

	const realmData = await response.json();
	if(realmData.errorMsg) {
		plainTextErrorLogger(`${api_url}worlds/v1/link/<code>`, 403, realmData.errorMsg);

		if(realmData.errorMsg === "User found in block list") return {errorMsg: `Account has been banned from this realm.\nIf you would like to bypass this limitation, you can link your account using </link:1083907918589595732>. Yern will use your account to join realms instead.`};

		return realmData;
	}

	// join realm
	if(!realmData.member) await joinRealm(accountID, realmCode);

	const { id, remoteSubscriptionId, ownerUUID: ownerXUID, motd, defaultPermission, state, expired, expiredTrial, worldType, maxPlayers, activeSlot, clubId } = realmData;
	const name = realmData.name.substring(0, 30);

	let clubData = {};
	let realmOwner = "N/A";
	if(getExtendedInfo) {
		clubData = await getClubData(accountID, clubId);

		// mass invite players to Yern Anarchy
		setImmediate(async () => {
			const members = clubData.clubPresence;
			if(!members) return;

			const xuids = [];

			for(const member of members) {
				const { xuid } = member;

				xuids.push(xuid);
			}

			// invitePlayers("952814286474989578", 16167115, xuids);

			// add all players to Yern database
			// to prevent 413 Entity too Large, we split the request into two
			setImmediate(() => {
				const half = Math.floor(xuids.length / 2);
				getXboxAccountDataBulk(accountID, xuids.slice(0, half));
				getXboxAccountDataBulk(accountID, xuids.slice(half));
			});
		});

		realmOwner = (await getXboxUserData(accountID, ownerXUID))?.displayName ?? "N/A";
	}

	const realmInfo = {
		realmCode: realmCode,
		id: id,
		remoteSubscriptionId: remoteSubscriptionId,
		owner: realmOwner,
		ownerXUID: ownerXUID,
		name: name,
		motd: motd,
		defaultPermission: defaultPermission,
		state: state,
		expired: expired,
		expiredTrial: expiredTrial,
		worldType: worldType,
		maxPlayers: maxPlayers,
		onlinePlayers: clubData.clubPresenceCount ?? "N/A",
		clubId: clubId,
		worldSlot: activeSlot,
		joinedMembers: clubData.membersCount ?? "N/A",
		moderatorCount: clubData.moderatorsCount ?? "N/A",
		creationDate: clubData.creationDateUtc ?? "N/A",
		totalJoinsToday: clubData.clubPresenceTodayCount ?? "N/A",
		honeypot: honeypotRealmXUIDs.includes(ownerXUID)
	};

	return realmInfo;
}

async function getRealmAddress(realm, accountID) {
	const authToken = await getRealmsAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	let id;
	if(isNaN(realm)) {
		let realmData;

		if(realm.startsWith("=")) {
			if(typeof accountID !== "string") return {errorMsg:"Please link your account with </link:1083907918589595732> to be able to use the Yern ID system."};

			const dbRealm = await realmModel.findOne({cid:realm});
			if(!dbRealm) return {errorMsg:"Invalid Yern ID."};

			const allRealms = await getRealmsList(accountID);

			const _realm = allRealms.find(({id}) => id === dbRealm.id);
			if(!_realm) return {errorMsg:"The realm associated with this Yern ID was not found in your realms list."};

			realmData = _realm;
		} else realmData = await getRealmData(realm, accountID);

		if(realmData.errorMsg) return realmData;
		id = realmData.id;
	} else id = realm;

	const response = await fetch(api_url + `worlds/${id}/join`, {
		method: "GET",
		headers: {
			...realm_api_headers,

			authorization: authToken
		}
	}).catch(() => {});
	if(!response) return {errorMsg: "Unknown"};

	if(response.status !== 200 && response.status !== 403) {
		return {errorMsg: errorCodes[response.status] ?? `${response.status} ${response.statusText} ${await response.text()}`};
	}

	const realmResponse = await response.json();
	if(response.status === 403) {
		plainTextErrorLogger(`${api_url}worlds/<id>/join`, 403, realmResponse.errorMsg);
		return realmResponse;
	}

	const address = realmResponse.address;
	const ip = address.substring(0, address.indexOf(":"));
	const port = address.substring(address.indexOf(":") + 1);

	return {
		ip: ip,
		port: Number(port)
	};
}

async function getRealmsList(accountID) {
	const authToken = await getRealmsAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	const response = await fetch(api_url + "worlds", {
		method: "GET",
		headers: {
			...realm_api_headers,

			authorization: authToken
		}
	});

	if(response.status !== 200 && response.status !== 403) {
		return {errorMsg: errorCodes[response.status] ?? `${response.status} ${response.statusText} ${await response.text()}`};
	}

	const { errorMsg, servers: allRealms} = await response.json();

	if(errorMsg) {
		plainTextErrorLogger(`${api_url}worlds`, 403, errorMsg);

		return {errorMsg:errorMsg};
	}

	// index all the realms the person is in
	setImmediate(async () => {
		for(const realm of allRealms) {
			const { id, name } = realm;

			let dbRealm = await realmModel.findOne({id:id});
			if(dbRealm) continue;

			dbRealm = createRealmDefaults({
				id: id,
				name: name
			});

			dbRealm.save();
		}
	});

	return allRealms;
}

/*
async function invitePlayers(accountID, realmId = 0, xuids = []) {
	const authToken = await getRealmsAuthToken(accountID);

	const invites = {};

	for(const xuid of xuids) {
		invites[xuid] = "ADD";
	}

	const body = JSON.stringify({invites});

	const response = await fetch(api_url + `invites/${realmId}/invite/update`, {
		method: "PUT",
		headers: {
			...realm_api_headers,

			"Content-Length": body.length,
			authorization: authToken
		},
		body: body
	});

	if(response.status !== 200 && response.status !== 403) {
		return {errorMsg: errorCodes[response.status] ?? `${response.status} ${response.statusText} ${await response.text()}`};
	}

	return await response.json();
}
*/

async function getInvites(accountID) {
	const authToken = await getRealmsAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	const response = await fetch(api_url + "invites/pending", {
		method: "GET",
		headers: {
			...realm_api_headers,

			authorization: authToken
		}
	});

	if(response.status !== 200 && response.status !== 403) {
		return {errorMsg: errorCodes[response.status] ?? `${response.status} ${response.statusText} ${await response.text()}`};
	}

	return (await response.json()).invites;
}

async function acceptInvite(accountID, realmID) {
	const authToken = await getRealmsAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	const response = await fetch(api_url + `invites/accept/${realmID}`, {
		method: "PUT",
		headers: {
			...realm_api_headers,

			authorization: authToken
		}
	});

	if(response.status === 403) return await response.json();

	if(response.status !== 204) {
		return {errorMsg: errorCodes[response.status] ?? `${response.status} ${response.statusText} ${await response.text()}`};
	}

	return {};
}

async function rejectInvite(accountID, realmID) {
	const authToken = await getRealmsAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	const response = await fetch(api_url + `invites/reject/${realmID}`, {
		method: "PUT",
		headers: {
			...realm_api_headers,

			authorization: authToken
		}
	});

	if(response.status === 403) return await response.json();

	if(response.status !== 204) {
		return {errorMsg: errorCodes[response.status] ?? `${response.status} ${response.statusText} ${await response.text()}`};
	}

	return {};
}

async function joinRealm(accountID, realmCode) {
	const authToken = await getRealmsAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	const response = await fetch(api_url + `invites/v1/link/accept/${realmCode}`, {
		method: "POST",
		headers: {
			...realm_api_headers,

			authorization: authToken
		}
	}).catch(() => {});

	if(response.status !== 200 && response.status !== 403) {
		return {errorMsg: errorCodes[response.status] ?? `${response.status} ${response.statusText} ${await response.text()}`};
	}

	const realmData = await response.json();

	if(realmData.errorMsg) {
		plainTextErrorLogger(`${api_url}invites/v1/link/accept/code`, response.status, realmData.errorMsg);
	}

	return realmData;
}

async function leaveRealm(accountID, realmID) {
	const authToken = await getRealmsAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	const response = await fetch(api_url + `invites/${realmID}`, {
		method: "DELETE",
		headers: {
			...realm_api_headers,

			authorization: authToken
		}
	}).catch(() => {});

	if(response.status !== 204) {
		return {errorMsg: errorCodes[response.status] ?? `${response.status} ${response.statusText} ${await response.text()}`};
	}

	return {};
}

module.exports = {
	getRealmsAuthToken: getRealmsAuthToken,
	getRealmData: getRealmData,
	getRealmAddress: getRealmAddress,
	getRealmsList: getRealmsList,
	// invitePlayers: invitePlayers,
	getInvites: getInvites,
	acceptInvite: acceptInvite,
	rejectInvite: rejectInvite,
	joinRealm: joinRealm,
	leaveRealm: leaveRealm
};

async function plainTextErrorLogger(endpoint, statusCode, errorMsg) {
	const errorLogs = JSON.parse(fs.readFileSync("./data/realmApiMessages.json"));

	if(errorLogs.includes(errorMsg)) return;

	const response = await fetch("https://discord.com/api/webhooks/1123382032131690576/JUr_1HBi14PItWuL-UTeSBZeTNb6MvyJ6ZYfCXiwEitsmA4t4SsYQuCMaOgDo4MxupBB", {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			username: "Not Yern",
			avatar_url: "https://cdn.discordapp.com/avatars/1169735844941271100/e7b90b26163a5e67e4201a03509815dd.webp?size=4096",
			content: `Endpoint: ${endpoint}\nStatus Code: ${statusCode}\nError Msg: ${errorMsg}`
		})
	});

	if(response.status !== 204) return;

	errorLogs.push(errorMsg);

	fs.writeFileSync("./data/realmApiMessages.json", JSON.stringify(errorLogs));
}