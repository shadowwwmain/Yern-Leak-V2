"use strict";

const fetch = require("node-fetch");
const { v4: uuidv4 } = require("uuid");
const { getXboxAuthToken } = require("./xbox.js");

const apiUrl = "https://20ca2.playfabapi.com";
const sdkVersion = "XPlatCppSdk-3.6.190304";

const api_headers = {
	"Accept": "application/json",
	"content-type": "application/json; charset=utf-8",
	"User-Agent": "libhttpclient/1.0.0.0",
	"x-playfabsdk": sdkVersion,
	"x-reporterrorassuccess": true,
	"Accept-Language": "en-US",
	"Accept-Encoding": "gzip, deflate, br",
	"Host": "20ca2.playfabapi.com",
	"Connection": "Keep-Alive",
	"Cache-Control": "no-cache"
};

// Used for offline playfab authentication
async function getTitlePublicKey() {
	const body = JSON.stringify({
		TitleId: "20CA2",
		TitleSharedSecret: "S8RS53ZEIGMYTYG856U3U19AORWXQXF41J7FT3X9YCWAC7I35X"
	});

	const response = await fetch(`${apiUrl}/Client/GetTitlePublicKey?sdk=${sdkVersion}`, {
		method: "POST",
		headers: {
			...api_headers,

			"Content-Length": body.length,
		},
		body: body
	});

	return await response.json();
}

// Used for generating authentication tokens to use PlayFab
async function loginWithXbox(accountID) {
	const authToken = await getXboxAuthToken(accountID, "rp://playfabapi.com/");
	if (authToken.errorMsg) return authToken;

	const body = JSON.stringify({
		CreateAccount: true,
		EncryptedRequest: null,
		InfoRequestParameters: {
			GetCharacterInventories: false,
			GetCharacterList: false,
			GetPlayerProfile: true,
			GetPlayerStatistics: false,
			GetTitleData: false,
			GetUserAccountInfo: true,
			GetUserData: false,
			GetUserInventory: false,
			GetUserReadOnlyData: false,
			GetUserVirtualCurrency: false,
			PlayerStatisticNames: null,
			ProfileConstraints: null,
			TitleDataKeys: null,
			UserDataKey: null,
			UserReadOnlyDataKeys: null
		},
		PlayerSecret: null,
		TitleId: "20CA2",
		XboxToken: authToken
	}, null, 2);

	const response = await fetch(`${apiUrl}/Client/LoginWithXbox?sdk=${sdkVersion}`, {
		method: "POST",
		headers: {
			...api_headers,

			"Content-Length": body.length
		},
		body: body
	});

	const data = await response.json();

	if (data.status !== "OK") return { errorMsg: `[loginWithXbox] ${data.code} ${data.status}. Error: ${data.errorMessage}` };

	return data.data;
}

// Used for generating an entity token to access the marketplace. Not needed to get MCToken
async function getEntityToken(accountID) {
	const authData = await loginWithXbox(accountID);
	if (authData.errorMsg) return authData;

	const body = JSON.stringify({
		Entity: {
			Id: authData.PlayFabId,
			Type: "master_player_account"
		}
	}, null, 2);

	const response = await fetch(`${apiUrl}/Authentication/GetEntityToken?sdk=${sdkVersion}`, {
		method: "POST",
		headers: {
			...api_headers,

			"x-entitytoken": authData.EntityToken.EntityToken,
			"Content-Length": body.length
		},
		body: body
	});

	const data = await response.json();
	if (data.status !== "OK") return { errorMsg: `${data.code} ${data.status}. Error: ${data.errorMessage}` };

	data.data.authData = authData;

	return data.data;
}

// Get the currently applied skin
async function getSkinData(accountID) {
	const authData = await getEntityToken(accountID);
	if (authData.errorMsg) return authData;

	const body = JSON.stringify({
		Entity: {
			Id: authData.authData.PlayFabId,
			Type: "master_player_account"
		},
		EscapeObject: null
	});

	const response = await fetch(`${apiUrl}/Object/GetObjects?sdk=${sdkVersion}`, {
		method: "POST",
		headers: {
			...api_headers,

			"x-entitytoken": authData.EntityToken,
			"Content-Length": body.length
		},
		body: body
	});

	const data = await response.json();
	if (data.status !== "OK") return { errorMsg: `${data.code} ${data.status}. Error: ${data.errorMessage}` };

	return data.data;
}

// Used for getting a MCToken authorization header
async function getMCToken(accountID) {
	const authData = await loginWithXbox(accountID);
	if (authData.errorMsg) return authData;

	const body = JSON.stringify({
		device: {
			applicationType: "MinecraftPE",
			capabilities: null,
			gameVersion: "1.20.0",
			// Device ID
			id: uuidv4(),
			// Total amount of memory the sysem has in bytes
			// This value is equal to 8 GiB
			memory: "8589934592",
			platform: "Windows10",
			playFabTitleId: "20CA2",
			storePlatform: "uwp.store",
			treatmentOverrides: null,
			type: "Windows10"
		},
		user: {
			language: "en",
			languageCode: "en-US",
			regionCode: "US",
			token: authData.SessionTicket,
			tokenType: "PlayFab"
		}
	});

	const response = await fetch("https://authorization.franchise.minecraft-services.net/api/v1.0/session/start", {
		method: "POST",
		headers: {
			"Accept": "*/*",
			"content-type": " application/json",
			"User-Agent": "libhttpclient/1.0.0.0",
			"Accept-Language": "en-US",
			"Accept-Encoding": "gzip, deflate, br",
			"Host": "authorization.franchise.minecraft-services.net",
			"Content-Length": body.length,
			"Connection": "Keep-Alive",
			"Cache-Control": "no-cache",
		},
		body: body
	});

	return (await response.json()).result;
}

async function getUserPublisherData(accountID) {
	const authData = await loginWithXbox(accountID);
	if (authData.errorMsg) return authData;

	const body = JSON.stringify({
		Entity: {
			Id: authData.PlayFabId,
			Type: "master_player_account"
		}
	});

	const response = await fetch(`${apiUrl}/Client/GetUserPublisherData`, {
		method: "POST",
		headers: {
			...api_headers,

			"x-playfabsdk": undefined,
			"x-reporterrorassuccess": undefined,
			"x-authorization": authData.SessionTicket,
			"Content-Length": body.length
		},
		body: body
	});

	const data = await response.json();
	if (data.status !== "OK") return { errorMsg: `${data.code} ${data.status}. Error: ${data.errorMessage}` };

	return data.data;
}

async function getVirtualCurrency(accountID) {
	const authData = await getEntityToken(accountID);
	if (authData.errorMsg) return authData;

	const response = await fetch(`${apiUrl}/inventory/GetVirtualCurrencies`, {
		method: "POST",
		headers: {
			...api_headers,

			"x-entitytoken": authData.EntityToken,
			"Content-Length": 0
		}
	});

	const data = await response.json();
	if (data.status !== "OK") return { errorMsg: `${data.code} ${data.status}. Error: ${data.errorMessage}` };

	return data.data;
}

async function getInventoryItems(accountID) {
	const authData = await getEntityToken(accountID);
	if (authData.errorMsg) return authData;

	const body = JSON.stringify({
		ReceiptData: {
			DeviceId: uuidv4()
		}
	});

	const response = await fetch(`${apiUrl}/inventory/GetVirtualCurrencies`, {
		method: "POST",
		headers: {
			...api_headers,

			"x-entitytoken": authData.EntityToken,
			"Content-Length": body.length
		},
		body: body
	});

	const data = await response.json();
	if (data.status !== "OK") return { errorMsg: `${data.code} ${data.status}. Error: ${data.errorMessage}` };

	return data.data;
}

module.exports = {
	getTitlePublicKey: getTitlePublicKey,
	loginWithXbox: loginWithXbox,
	getEntityToken: getEntityToken,
	getSkinData: getSkinData,
	getMCToken: getMCToken,
	getUserPublisherData: getUserPublisherData,
	getVirtualCurrency: getVirtualCurrency,
	getInventoryItems: getInventoryItems
};