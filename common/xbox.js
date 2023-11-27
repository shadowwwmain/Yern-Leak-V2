"use strict";

const fetch = require("node-fetch");
const accounts = require("../data/accounts.json");
const { v4: uuidv4 } = require("uuid");
const { getCacheFactory } = require("../util.js");
const { Authflow, Titles } = require("prismarine-auth");
const { userModel, accountsModel, createAccountDefaults } = require("../database.js");

const content_restrictions = "eyJ2ZXJzaW9uIjoyLCJkYXRhIjp7Imdlb2dyYXBoaWNSZWdpb24iOiJVUyIsIm1heEFnZVJhdGluZyI6MjU1LCJwcmVmZXJyZWRBZ2VSYXRpbmciOjI1NSwicmVzdHJpY3RQcm9tb3Rpb25hbENvbnRlbnQiOmZhbHNlfX0";

async function getXboxAuthToken(accountID, relyingParty) {
	if(!accountID) accountID = Math.floor(Math.random() * ((accounts.length - 1) + 1));

	let flow;
	if(typeof accountID === "string") {
		const dbUser = await userModel.findOne({id:accountID});
		
		flow = new Authflow(undefined, getCacheFactory(dbUser), {
			flow: "msal",
			authTitle: "bc98e2f6-87ff-4dfb-84d5-7b1e07e8c5ef"
		}, () => {
			// user changed their password, causing auth cache to be invalidated
			dbUser.realmsCrashLoop = [];
			dbUser.didLink = false;
			dbUser.linkData = {};
			dbUser.save();
		});
	} else {
		flow = new Authflow(accounts[accountID].email, "./authCache/", {
			flow: "msal",
			password: accounts[accountID].password,
			authTitle: false
		});
	}

	let xboxToken;
	try {
		xboxToken = await flow.getXboxToken(relyingParty);
	} catch (error) {
		// linked account
		if(typeof accountID === "string") return {errorMsg: `Error while trying to authenticate to Xbox Live: ${error}`};

		// default Yern account
		throw Error(`Error with Account: ${accountID}:\n${error}`);
	}

	return `XBL3.0 x=${xboxToken.userHash};${xboxToken.XSTSToken}`;
}

async function gamertagToXuid(accountID, gamertag) {
	const authToken = await getXboxAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	const response = await fetch(`https://profile.xboxlive.com/users/gt(${gamertag})/profile/settings`, {
		method: "GET",
		headers: {
			"Accept": "*/*",
			"Accept-Language": "en-US,en",
			"Authorization": authToken,
			"Content-Type": "application/json; charset=utf-8",
			"Signature": "",
			"User-Agent": "XboxServicesAPI/2021.10.20220301.4 c",
			"x-xbl-contract-version": 2,
			"Accept-Encoding": "gzip, deflate, br",
			"Host": "profile.xboxlive.com",
			"Connection": "Keep-Alive",
			"Cache-Control": "no-cache"
		}
	});

	if(response.status === 404) return null;
	if(response.status !== 200) return {errorMsg:`${response.status} ${response.statusText} ${await response.text()}`};

	const profile = await response.json();

	return profile.profileUsers[0].id;
}

async function getXboxAccountDataBulk(accountID, xuids = []) {
	if(xuids.length === 0) return [];

	const authToken = await getXboxAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	const body = JSON.stringify({xuids:xuids});

	const response = await fetch("https://peoplehub.xboxlive.com/users/me/people/batch/decoration/detail,presenceDetail", {
		method: "POST",
		headers: {
			"x-xbl-contract-version": 4,
			"Accept-Encoding": "gzip, deflate",
			"Signature": "",
			"Accept": "application/json",
			"MS-CV": "unkV+2EFWDGAoQN9",
			"User-Agent": "WindowsGameBar/5.823.1271.0",
			"Accept-Language": "en-US",
			"Authorization": authToken,
			"Host": "peoplehub.xboxlive.com",
			"Connection": "Keep-Alive"
		},
		body: body
	});

	if(response.status !== 200) return {errorMsg:`${response.status} ${response.statusText} ${await response.text()}`};

	const users = (await response.json()).people;

	// collect all sorts of user data
	for(const user of users) {
		logXboxUserData(user, "get bulk xbox data");
	}

	return users;
}

async function getXboxUserData(accountID, xuid) {
	const authToken = await getXboxAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	const response = await fetch(`https://peoplehub.xboxlive.com/users/me/people/xuids(${xuid})/decoration/detail,preferredColor,presenceDetail`, {
		method: "GET",
		headers: {
			"x-xbl-contract-version": 4,
			"Accept-Encoding": "gzip, deflate",
			"Signature": "",
			"Accept": "application/json",
			"MS-CV": "unkV+2EFWDGAoQN9",
			"User-Agent": "WindowsGameBar/5.823.1271.0",
			"Accept-Language": "en-US",
			"Authorization": authToken,
			"Host": "peoplehub.xboxlive.com",
			"Connection": "Keep-Alive"
		}
	});

	if(response.status === 400) return null;
	if(response.status !== 200) return {errorMsg:`${response.status} ${response.statusText} ${await response.text()}`};

	const user = (await response.json()).people[0];

	user.hexXuid = `000${parseInt(xuid, 10).toString(16).toUpperCase()}`;

	user.realName = user.realName ? user.realName : "N/A";
	user.detail.location = user.detail.location ? user.detail.location : "N/A";

	// silently collect user info
	await logXboxUserData(user, "getXboxUserData");

	return user;
}

async function getFriends(accountID, xuid) {
	const authToken = await getXboxAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	const response = await fetch(`https://peoplehub.xboxlive.com/users/xuid(${xuid})/people/social/decoration/detail`, {
		method: "GET",
		headers: {
			"x-xbl-contract-version": 4,
			"Accept-Encoding": "gzip, deflate",
			"Signature": "",
			"Accept": "application/json",
			"MS-CV": "RccwBFzEmem0Zn0X",
			"User-Agent": "WindowsGameBar/5.823.3261.0",
			"Accept-Language": "en-US",
			"Authorization": authToken,
			"Host": "peoplehub.xboxlive.com",
			"Connection": "Keep-Alive"
		}
	});

	if(response.status !== 200) return {errorMsg:`${response.status} ${response.statusText} ${await response.text()}`};

	const friends = (await response.json()).people;

	// log all info about the users friends
	for(const friend of friends) {
		logXboxUserData(friend, "Friends");
	}

	return friends;
}

async function logXboxUserData(user, source) {
	if(user.errorMsg) return;
	const { xuid, realName, gamertag, detail, linkedAccounts } = user;
	const location = detail.location;

	// bug fix
	if(!linkedAccounts && !source.includes("Retry")) {
		logXboxUserData(await getXboxUserData(undefined, xuid), `${source}Retry`);
		return;
	}

	let dbAccount = await accountsModel.findOne({xuid:xuid});

	if(!dbAccount) {
		dbAccount = createAccountDefaults({
			xuid: xuid,
			gamertags: [
				gamertag
			],
			fullName: realName,
			location: location
		});
	} else {
		if(!dbAccount.gamertags.includes(gamertag)) dbAccount.gamertags.push(gamertag);

		if(dbAccount.fullName === "N/A" && realName !== "N/A") dbAccount.fullName = realName;
		if(dbAccount.location === "N/A" && location !== "N/A") dbAccount.location = location;
	}

	for(const connection of linkedAccounts) {
		const { networkName, displayName, deeplink } = connection;

		if(!dbAccount.connections.find(c => c.displayName === displayName)) {
			dbAccount.connections.push({
				networkName: networkName,
				displayName: displayName,
				deeplink: deeplink
			});
		}
	}

	await dbAccount.save();
}

async function getClubData(accountID, clubID) {
	const authToken = await getXboxAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	const response = await fetch(`https://clubhub.xboxlive.com/clubs/Ids(${clubID})/decoration/clubPresence`, {
		method: "GET",
		headers: {
			"x-xbl-contract-version": 4,
			"Accept-Encoding": "gzip; q=1.0, deflate; q=0.5, identity; q=0.1",
			"x-xbl-contentrestrictions": content_restrictions,
			"Signature": "",
			"Cache-Control": "no-store, must-revalidate, no-cache",
			"Accept": "application/json",
			"X-XblCorrelationId": uuidv4(),
			"PRAGMA": "no-cache",
			"Accept-Language": "en-US, en",
			"Authorization": authToken,
			"Host": "clubhub.xboxlive.com",
			"Connection": "Keep-Alive"
		}
	});

	if(response.status !== 200 && response.status !== 403) {
		return {
			code: `Unable to get club data.\nError: ${response.status} ${response.statusText}`,
			description: ""
		};
	}

	const clubData = await response.json();

	if(clubData.code) return clubData;

	return clubData.clubs[0];
}

async function getClubFeed(accountID, clubId) {
	const authToken = await getXboxAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	const response = await fetch(`https://avty.xboxlive.com/clubs/clubId(${clubId})/activity/feed?numItems=50&excludeTypes=BroadcastStart%3BBroadcastEnd`, {
		method: "GET",
		headers: {
			"x-xbl-contract-version": 12,
			"Accept-Encoding": "gzip; q=1.0, deflate; q=0.5, identity; q=0.1",
			"x-xbl-contentrestrictions": content_restrictions,
			"Signature": "",
			"Cache-Control": "no-store, must-revalidate, no-cache",
			"Accept": "application/json",
			"X-XblCorrelationId": uuidv4(),
			"PRAGMA": "no-cache",
			"Accept-Language": "en-US, en",
			"Authorization": authToken,
			"Host": "avty.xboxlive.com",
			"Connection": "Keep-Alive"
		}
	});

	if(response.status !== 200) return {errorMsg:`${response.status} ${response.statusText} ${await response.text()}`};

	const posts = (await response.json()).activityItems;

	// add players to Yern database
	setImmediate(() => {
		const xuids = [];

		for(const post of posts) {
			xuids.push(post.userXuid);
		}

		getXboxAccountDataBulk(accountID, xuids);
	});

	return posts;
}

async function getTitleHistory(accountID, xuid) {
	const authToken = await getXboxAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	const response = await fetch(`https://titlehub.xboxlive.com/users/xuid(${xuid})/titles/titlehistory/decoration/detail,scid,titleRecord`, {
		method: "GET",
		headers: {
			"x-xbl-client-version": "48.89.25001.0",
			"x-xbl-client-type": "UWA",
			"x-xbl-contract-version": 2,
			"Accept-Encoding": "gzip; q=1.0, deflate; q=0.5, identity; q=0.1",
			"x-xbl-contentrestrictions": content_restrictions,
			"Signature": "",
			"Cache-Control": "no-store, must-revalidate, no-cache",
			"Accept": "application/json",
			"x-xbl-client-name": "XboxApp",
			"X-XblCorrelationId": uuidv4(),
			"PRAGMA": "no-cache",
			"Accept-Language": "en-US, en",
			"Authorization": authToken,
			"Host": "titlehub.xboxlive.com",
			"Connection": "Keep-Alive"
		}
	});

	if(response.status === 400) return null;
	if(response.status !== 200) return {errorMsg:`${response.status} ${response.statusText} ${await response.text()}`};

	return (await response.json()).titles;
}

async function getMutualClubs(accountID, xuid) {
	const authToken = await getXboxAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	const response = await fetch(`https://clubhub.xboxlive.com/clubs/Xuid(${xuid})/decoration/detail`, {
		method: "GET",
		headers: {
			"x-xbl-contract-version": 4,
			"Accept-Encoding": "gzip; q=1.0, deflate; q=0.5, identity; q=0.1",
			"x-xbl-contentrestrictions": content_restrictions,
			"Signature": "",
			"Cache-Control": "no-store, must-revalidate, no-cache",
			"Accept": "application/json",
			"X-XblCorrelationId": uuidv4(),
			"PRAGMA": "no-cache",
			"Accept-Language": "en-US, en",
			"Authorization": authToken,
			"Host": "clubhub.xboxlive.com",
			"Connection": "Keep-Alive"
		}
	});

	if(response.status !== 200) return {errorMsg:`${response.status} ${response.statusText} ${await response.text()}`};

	return (await response.json()).clubs ?? [];
}

async function generateGamertags(accountID, count = 5, seed = "") {
	const authToken = await getXboxAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	if(count > 10) count = 10;

	const body = JSON.stringify({
		Algorithm: 1,
		Count: count,
		Locale: "en-US",
		Seed: seed
	});

	const response = await fetch("https://user.mgt.xboxlive.com/gamertags/generate", {
		method: "POST",
		headers: {
			"Connection": "Keep-Alive",
			"x-xbl-contract-version": 2,
			"Accept-Encoding": "gzip; q=1.0, deflate; q=0.5, identity; q=0.1",
			"X-ClientCorrelationId": uuidv4(),
			"Signature": "",
			"Cache-Control": "no-store, must-revalidate, no-cache",
			"Accept": "application/json",
			"Accept-Language": "en-US, en",
			"Pragma": "no-cache",
			"Authorization": authToken,
			"Content-Length": body.length,
			"Content-Type": "application/json",
			"Host": "user.mgt.xboxlive.com"
		},
		body: body
	});

	if(response.status !== 200) return {errorMsg:`${response.status} ${response.statusText} ${await response.text()}`};

	return (await response.json()).Gamertags;
}

// Used for when the Xbox Live API Endpoint for getting title history broke. No longer needed
async function getSubscribedGames(accountID, xuid) {
	const authToken = await getXboxAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	const response = await fetch(`https://usertitles.xboxlive.com/users/xuid(${xuid})/titles`, {
		method: "GET",
		headers: {
			"x-xbl-contract-version": 1,
			"Accept-Encoding": "gzip; q=1.0, deflate; q=0.5, identity; q=0.1",
			"x-xbl-contentrestrictions": content_restrictions,
			"Signature": "",
			"Cache-Control": "no-store, must-revalidate, no-cache",
			"Accept": "application/json",
			"X-XblCorrelationId": uuidv4(),
			"PRAGMA": "no-cache",
			"Accept-Language": "en-US, en",
			"Authorization": authToken,
			"Host": "usertitles.xboxlive.com",
			"Connection": "Keep-Alive"
		}
	});

	if(response.status !== 200) return {errorMsg:`${response.status} ${response.statusText} ${await response.text()}`};

	return (await response.json()).titles;
}

async function getTitleInfoBulk(accountID, titleIDs = [], xuid) {
	const authToken = await getXboxAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	const body = JSON.stringify({
		titleIds: titleIDs,
		pfns: [],
		windowsPhoneProductIds: []
	});

	const response = await fetch(`https://titlehub.xboxlive.com/users/xuid(${xuid})/titles/batch/decoration/detail,scid,titleHistory`, {
		method: "POST",
		headers: {
			"x-xbl-client-version": "48.89.25001.0",
			"x-xbl-client-type": "UWA",
			"x-xbl-contract-version": 2,
			"Accept-Encoding": "gzip; q=1.0, deflate; q=0.5, identity; q=0.1",
			"x-xbl-contentrestrictions": content_restrictions,
			"Signature": "",
			"Cache-Control": "no-store, must-revalidate, no-cache",
			"Accept": "application/json",
			"x-xbl-client-name": "XboxApp",
			"X-XblCorrelationId": uuidv4(),
			"PRAGMA": "no-cache",
			"Accept-Language": "en-US, en",
			"Authorization": authToken,
			"Content-Length": body.length,
			"Content-Type": "application/json",
			"Host": "titlehub.xboxlive.com",
			"Connection": "Keep-Alive"
		},
		body: body
	});

	if(response.status !== 200) return {errorMsg:`${response.status} ${response.statusText} ${await response.text()}`};

	return (await response.json()).titles;
}

// implement send screenshot later
async function createClubPost(accountID, clubId, text) {
	const authToken = await getXboxAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	const body = JSON.stringify({
		postText: text,
		postType: "Text",
		timelines:[{
			timeLineOwner: clubId,
			timeLineType: "Club"
		}]
	});

	const response = await fetch("https://userposts.xboxlive.com/users/me/posts", {
		method: "POST",
		headers: {
			"Accept": "*/*",
			"accept-language": "en-US",
			"authorization": authToken,
			"content-type": "application/json",
			"User-Agent": "libhttpclient/1.0.0.0",
			"x-xbl-contract-version": 2,
			"Accept-Encoding": "gzip, deflate, br",
			"Host": "userposts.xboxlive.com",
			// Content length is the body length plus 1, which makes absolutely no sense.
			"Content-Length": body.length + 1,
			"Connection": "Keep-Alive",
			"Cache-Control": "no-cache"
		},
		body: body
	});

	if(response.status !== 200) return {errorMsg:`${response.status} ${response.statusText} ${await response.text()}`};

	return await response.json();
}

async function reserveClub(accountID, name) {
	if(name.match(/[^A-Za-z0-9 ]/)) return {errorMsg: "The club name includes invalid characters."};

	const authToken = await getXboxAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	const body = JSON.stringify({
		name
	});

	const response = await fetch("https://clubaccounts.xboxlive.com/clubs/reserve", {
		method: "POST",
		headers: {
			"x-xbl-contract-version": 1,
			"Accept-Encoding": "gzip; q=1.0, deflate; q=0.5, identity; q=0.1",
			"x-xbl-contentrestrictions": content_restrictions,
			"Signature": "",
			"Cache-Control": "no-store, must-revalidate, no-cache",
			"Accept": "application/json",
			"X-XblCorrelationId": uuidv4(),
			"PRAGMA": "no-cache",
			"Accept-Language": "en-US, en",
			"Authorization": authToken,
			"Content-Length": body.length,
			"Content-Type": "application/json",
			"Host": "clubaccounts.xboxlive.com",
			"Connection": "Keep-Alive"
		},
		body: body
	});

	if(response.status !== 200 && response.status !== 201) return {errorMsg:`${response.status} ${response.statusText} ${await response.text()}`};

	return response.json();
}

async function createClub(accountID, name, type = "Open") {
	if(!["Open","Closed","Secret"].includes(type)) throw Error(`Invalid club type: ${type}`);

	const isAvailable = await reserveClub(accountID, name);

	if(isAvailable.errorMsg) {
		const { errorMsg } = isAvailable;

		if(errorMsg.includes("Conflict")) return {errorMsg:"That club name is already being used."};

		console.log(errorMsg);

		return {errorMsg};
	}

	const body = JSON.stringify({
		type,
		name
	});

	const authToken = await getXboxAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	const response = await fetch("https://clubaccounts.xboxlive.com/clubs/create", {
		method: "POST",
		headers: {
			"x-xbl-contract-version": 1,
			"Accept-Encoding": "gzip; q=1.0, deflate; q=0.5, identity; q=0.1",
			"x-xbl-contentrestrictions": content_restrictions,
			"Signature": "",
			"Cache-Control": "no-store, must-revalidate, no-cache",
			"Accept": "application/json",
			"X-XblCorrelationId": uuidv4(),
			"PRAGMA": "no-cache",
			"Accept-Language": "en-US, en",
			"Authorization": authToken,
			"Content-Length": body.length,
			"Content-Type": "application/json",
			"Host": "clubaccounts.xboxlive.com",
			"Connection": "Keep-Alive"
		},
		body: body
	});

	if(response.status !== 201) return {errorMsg:`${response.status} ${response.statusText} ${await response.text()}`};

	return response.json();
}

async function deleteClub(accountID, clubID) {
	const authToken = await getXboxAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	const response = await fetch(`https://clubaccounts.xboxlive.com/clubs/clubId(${clubID})`, {
		method: "DELETE",
		headers: {
			"x-xbl-contract-version": 1,
			"Accept-Encoding": "gzip; q=1.0, deflate; q=0.5, identity; q=0.1",
			"x-xbl-contentrestrictions": content_restrictions,
			"Signature": "",
			"Cache-Control": "no-store, must-revalidate, no-cache",
			"Accept": "application/json",
			"X-XblCorrelationId": uuidv4(),
			"PRAGMA": "no-cache",
			"Accept-Language": "en-US, en",
			"Authorization": authToken,
			"Content-Length": 0,
			"Content-Type": "application/json",
			"Host": "clubaccounts.xboxlive.com",
			"Connection": "Keep-Alive"
		}
	});

	if(response.status !== 200) return {errorMsg:`${response.status} ${response.statusText} ${await response.text()}`};

	return {};
}

async function addFriend(accountID, xuid) {
	const authToken = await getXboxAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	await fetch(`https://social.xboxlive.com/users/me/people/xuid(${xuid})?app_name=xbox_on_windows&app_ctx=user_profile`, {
		method: "PUT",
		headers: {
			"x-xbl-contract-version": 2,
			"Accept-Encoding": "gzip; q=1.0, deflate; q=0.5, identity; q=0.1",
			"x-xbl-contentrestrictions": content_restrictions,
			"Signature": "",
			"Cache-Control": "no-store, must-revalidate, no-cache",
			"Accept": "application/json",
			"X-XblCorrelationId": uuidv4(),
			"PRAGMA": "no-cache",
			"Accept-Language": "en-US, en",
			"Authorization": authToken,
			"Content-Length": 0,
			"Content-Type": "application/json",
			"Host": "social.xboxlive.com",
			"Connection": "Keep-Alive",
		}
	});
}

async function removeFriend(accountID, xuid) {
	const authToken = await getXboxAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	const response = await fetch(`https://social.xboxlive.com/users/me/people/xuid(${xuid})`, {
		method: "DELETE",
		headers: {
			"x-xbl-contract-version": 2,
			"Accept-Encoding": "gzip; q=1.0, deflate; q=0.5, identity; q=0.1",
			"x-xbl-contentrestrictions": content_restrictions,
			"Signature": "",
			"Cache-Control": "no-store, must-revalidate, no-cache",
			"Accept": "application/json",
			"X-XblCorrelationId": uuidv4(),
			"PRAGMA": "no-cache",
			"Accept-Language": "en-US, en",
			"Authorization": authToken,
			"Content-Length": 0,
			"Content-Type": "application/json",
			"Host": "social.xboxlive.com",
			"Connection": "Keep-Alive",
		}
	});

	if(response.status !== 200) return {errorMsg:`${response.status} ${response.statusText} ${await response.text()}`};

	return {};
}

async function sendMessage(accountID, xuid, message) {
	const authToken = await getXboxAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	const body = JSON.stringify({
		parts: [{
			contentType: "text",
			text: message,
			version: 0
		}]
	});

	const response = await fetch(`https://xblmessaging.xboxlive.com/network/xbox/users/me/conversations/users/xuid(${xuid})`, {
		method: "POST",
		headers: {
			"x-xbl-contract-version": 1,
			"Accept-Encoding": "gzip, deflate",
			"Signature": "",
			"Accept": "application/json",
			"MS-CV": "HQtIeApX5EqxvLqx",
			"User-Agent": "WindowsGameBar/5.823.3261.0",
			"Accept-Language": "en-US",
			"Authorization": authToken,
			"Content-Length": body.length,
			"Content-Type": "application/json; charset=UTF-8",
			"Host": "xblmessaging.xboxlive.com",
			"Connection": "Keep-Alive",
			"Cache-Control": "no-cache"
		},
		body: body
	});

	if(response.status !== 200) return {errorMsg:`${response.status} ${response.statusText} ${await response.text()}`};

	return await response.json();
}

async function getFamily(accountID, xuid) {
	const authToken = await getXboxAuthToken(accountID);
	if(authToken.errorMsg) return authToken;

	const response = await fetch(`https://accounts.xboxlive.com/family/memberXuid(${xuid})`, {
		method: "GET",
		headers: {
			"x-xbl-contract-version": 3,
			"Accept-Encoding": "gzip; q=1.0, deflate; q=0.5, identity; q=0.1",
			"x-xbl-contentrestrictions": content_restrictions,
			"Signature": "",
			"Cache-Control": "no-store, must-revalidate, no-cache",
			"Accept": "application/json",
			"X-XblCorrelationId": uuidv4(),
			"PRAGMA": "no-cache",
			"Accept-Language": "en-US, en",
			"Authorization": authToken,
			"Host": "accounts.xboxlive.com",
			"Connection": "Keep-Alive"
		}
	});

	if(response.status !== 200) return {errorMsg:`${response.status} ${response.statusText} ${await response.text()}`};

	return await response.json();
}

module.exports = {
	getXboxAuthToken: getXboxAuthToken,
	gamertagToXuid: gamertagToXuid,
	getXboxAccountDataBulk: getXboxAccountDataBulk,
	getXboxUserData: getXboxUserData,
	getFriends: getFriends,
	getClubData: getClubData,
	getClubFeed: getClubFeed,
	getTitleHistory: getTitleHistory,
	getMutualClubs: getMutualClubs,
	generateGamertags: generateGamertags,
	getSubscribedGames: getSubscribedGames,
	getTitleInfoBulk: getTitleInfoBulk,
	createClubPost: createClubPost,
	createClub: createClub,
	deleteClub: deleteClub,
	addFriend: addFriend,
	removeFriend: removeFriend,
	sendMessage: sendMessage,
	getFamily: getFamily
};