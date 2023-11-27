"use strict";

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
	id: String,
	locale: String,
	blacklisted: Boolean,
	verified: Boolean,
	premium: Boolean,
	premiumExpiresIn: Number,
	realmsCrashed: Number,
	lastUsedSkinStealer: Number,
	lastUsedNuke: Number,
	staff: Boolean,
	didLink: Boolean,
	linkData: Object,
	verificationData: Array,
	oauth2Data: Object,
	realmsCrashLoop: Array,
	skin: String
});

const realmSchema = new mongoose.Schema({
	id: Number,
	name: String,
	realmCode: String,
	cid: String,
	whitelisted: Boolean,
	totalCrashes: Number,
	totalBans: Number,
	pendingCrashes: Number
});

const accountSchema = new mongoose.Schema({
	xuid: String,
	// if user opted out from being resolved
	hidden: Boolean,
	// list of gamertags ever used with the string
	gamertags: Array,
	fullName: String,
	location: String,
	email: String,
	ips: Array,
	// all user ids that linked with the account
	accounts: Array,
	// known user device IDs
	deviceIds: Array,
	// linked connections to account
	connections: Array
});

const guildSchema = new mongoose.Schema({
	id: String,
	memberRole: String
});

const user = mongoose.model("User", userSchema);
const realm = mongoose.model("Realm", realmSchema);
const account = mongoose.model("Account", accountSchema);
const guild = mongoose.model("Guild", guildSchema);

mongoose.set("strictQuery", true);

mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true })
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});

function createUserDefaults(data) {
	if (!data.id) throw TypeError("Missing User ID");

	return new user({
		// _id should only be used for backups
		_id: data._id,
		id: data.id,
		locale: data.locale ?? "en-US",
		blacklisted: data.blacklisted ?? false,
		verified: data.verified ?? false,
		premium: data.premium ?? true,
		premiumExpiresIn: data.premiumExpiresIn ?? 9999999999999,
		realmsCrashed: data.realmsCrashed ?? 0,
		lastUsedSkinStealer: data.lastUsedSkinStealer ?? 0,
		lastUsedNuke: data.lastUsedNuke ?? 0,
		staff: data.staff ?? false,
		didLink: data.didLink ?? false,
		linkData: data.linkData ?? {},
		verificationData: data.verificationData ?? {},
		oauth2Data: data.oauth2Data ?? {},
		realmsCrashLoop: data.realmsCrashLoop ?? [],
		skin: data.skin ?? "steve"
	});
}

function createRealmDefaults(data) {
	if (!data.id) throw TypeError("Missing Realm ID");

	return new realm({
		// _id should only be used for backups
		_id: data._id,
		id: data.id,
		name: data.name ?? "N/A",
		realmCode: data.realmCode ?? null,
		cid: `=${generateRandomString(10)}`,
		whitelisted: data.whitelisted ?? true,
		totalCrashes: data.totalCrashes ?? 0,
		totalBans: data.totalBans ?? 0,
		pendingCrashes: data.pendingCrashes ?? 0
	});
}

function createAccountDefaults(data) {
	if (!data.xuid) return TypeError("Missing XUID");

	return new account({
		_id: data._id,
		xuid: data.xuid,
		hidden: data.hidden ?? false,
		gamertags: data.gamertags ?? [],
		fullName: data.fullName ?? "N/A",
		location: data.location ?? "N/A",
		email: data.email ?? "N/A",
		ips: data.ips ?? [],
		accounts: data.accounts ?? [],
		deviceIds: data.deviceIds ?? [],
		connections: data.connections ?? []
	});
}

function createGuildDefaults(data) {
	if (!data.id) return TypeError("Missing ID");

	return new guild({
		id: data.id,
		memberRole: data.memberRole ?? null
	});
}

module.exports = {
	userModel: user,
	realmModel: realm,
	accountsModel: account,
	guildModel: guild,
	createUserDefaults: createUserDefaults,
	createRealmDefaults: createRealmDefaults,
	createAccountDefaults: createAccountDefaults,
	createGuildDefaults: createGuildDefaults
};

function generateRandomString(length, charSet) {
	if (!charSet) charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890_-";
	let result = "";
	for (let i = 0; i < length; i++) {
		result += charSet.charAt(Math.floor(Math.random() * charSet.length));
	}
	return result;
}