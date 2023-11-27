"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const JWT = require("jsonwebtoken");
const accounts = require("../data/accounts.json");
const { NIL, v3: uuidv3, v4: uuidv4, v5: uuidv5 } = require("uuid");
const { createClient } = require("bedrock-protocol");
const { getCacheFactory, generateRandomString } = require("../util.js");
const { getXboxAccountDataBulk } = require("./xbox.js");
const { accountsModel } = require("../database.js");

const skins = {};

const skinFiles = fs
	.readdirSync("./data/skins")
	.filter(file => file.endsWith(".json"));

for (let skin of skinFiles) {
	skin = skin.replace(".json", "");

	try {
		skins[skin] = JSON.parse(fs.readFileSync(`./data/skins/${skin}.json`, "utf8"));
	} catch (err) {
		console.error(`Error while loading skin: ${skin}\n${err}`);
	}
}

function createBot(address, deviceOS = 11, dbUser) {
	const options = {
		host: address.ip,
		port: address.port,
		skipPing: true,
		conLog: process.env.NODE_ENV === "development" ? console.log : null,
		skinData: {
			ClientRandomId: generateRandomString(19, "12345678901"),

			CurrentInputMode: 3,
			DefaultInputMode: 3,

			DeviceModel: "Xbox Series X",
			DeviceOS: deviceOS,
			DeviceId: getDeviceId(deviceOS),

			PlayFabId: dbUser.linkData?.playFabId ?? generateRandomString(16, "qwertyuiopasdfghjklzxcvbnm12345678901"),
			PlatformOnlineId: (deviceOS === 11 || deviceOS === 12) ? generateRandomString(19, "1234567890") : "", // PlatformChatID. On vanilla, this field is set if your on playstation (122) or nintendo switch (12)

			...skins[dbUser.skin ?? "steve"]
		}
	};

	if (dbUser.didLink) {
		options.profilesFolder = getCacheFactory(dbUser);
		options.authTitle = "bc98e2f6-87ff-4dfb-84d5-7b1e07e8c5ef";
		options.flow = "msal";
	} else {
		options.profilesFolder = "./authCache/";
		options.username = accounts[0].email;
		options.password = accounts[0].password;
		options.authTitle = false;
		options.flow = "msal";
	}

	const client = createClient(options);

	massDataCollection(client, dbUser.id);

	client.options.protocolVersion = 622;

	client.createSubClient = createSubClient;
	client._disconnect = client.disconnect;

	let wasKicked = false;
	
	client.disconnect = () => {
		wasKicked = true;
		client._disconnect();
	};

	client.on("kick", (data) => {
		wasKicked = true;

		console.log(`Triggered! ${JSON.stringify(data)}`);
	});

	client.on("error", (error) => {
		if (wasKicked) return;

		client.emit("kick", { message: String(error) });
	});

	client.on("close", () => {
		if (wasKicked) return;

		client.emit("kick", { message: "Lost connection to server" });
	});

	// create functions
	client.sendCommand = (command, source = 0) => {
		client.write("command_request", {
			command: command.substring(0, 512),
			origin: {
				type: source,
				uuid: "",
				request_id: ""
			},
			internal: false,
			version: 72
		});
	};

	client.sendCommand2 = (command, source = 0) => {
		client.write("command_request_1", {
			command: command.substring(0, 512),
			origin: {
				type: source,
				uuid: "",
				request_id: ""
			},
			internal: false,
			version: 72
		});
	};

	client.sendCommand3 = (command, source = 0) => {
		client.write("command_request_2", {
			command: command.substring(0, 512),
			origin: {
				type: source,
				uuid: "",
				request_id: ""
			},
			internal: false,
			version: 72
		});
	};

	client.sendCommand4 = (command, source = 0) => {
		client.write("command_request_3", {
			command: command.substring(0, 512),
			origin: {
				type: source,
				uuid: "",
				request_id: ""
			},
			internal: false,
			version: 72
		});
	};

	client.sendMessage = (message) => {
		client.write("text", {
			type: "chat",
			needs_translation: false,
			source_name: client.username,
			message: message,
			xuid: client.profile.xuid,
			platform_chat_id: client.options.skinData.PlatformOnlineId
		});
	};

	client.sendMessage2 = (message) => {
		client.write("text_1", {
			type: "chat",
			needs_translation: false,
			source_name: client.username,
			message: message,
			xuid: client.profile.xuid,
			platform_chat_id: client.options.skinData.PlatformOnlineId
		});
	};

	client.sendMessage3 = (message) => {
		client.write("text_2", {
			type: "chat",
			needs_translation: false,
			source_name: client.username,
			message: message,
			xuid: client.profile.xuid,
			platform_chat_id: client.options.skinData.PlatformOnlineId
		});
	};

	client.sendMessage4 = (message) => {
		client.write("text_3", {
			type: "chat",
			needs_translation: false,
			source_name: client.username,
			message: message,
			xuid: client.profile.xuid,
			platform_chat_id: client.options.skinData.PlatformOnlineId
		});
	};

	let requestId = 101;
	client.getRequestID = () => {
		return requestId += 4;
	};

	return client;
}

const algorithm = "ES384";
const curve = "secp384r1";
const pem = { format: "pem", type: "sec1" };
const der = { format: "der", type: "spki" };

function createSubClient(subClientId, skin, gamertag, xuid = "") {
	const ecdhKeyPair = crypto.generateKeyPairSync("ec", { namedCurve: curve });
	const publicKeyDER = ecdhKeyPair.publicKey.export(der);
	ecdhKeyPair.privateKey.export(pem);
	const clientX509 = publicKeyDER.toString("base64");

	const selectedSkin = skins[skin ?? "alex"];

	const payload = {
		extraData: {
			XUID: xuid,
			displayName: gamertag,
			identity: uuidv4()
		},
		identityPublicKey: clientX509,
	};

	const privateKey = ecdhKeyPair.privateKey;

	const identity = JWT.sign(payload, privateKey, { algorithm, noTimestamp: true, notBefore: 0, expiresIn: 60 * 60, header: { x5u: clientX509, typ: undefined } });

	const deviceOS = this.options.skinData.DeviceOS;

	const skinData = {
		...selectedSkin,
		ClientRandomId: Date.now(),
		CurrentInputMode: this.options.skinData.CurrentInputMode,
		DefaultInputMode: this.options.skinData.DefaultInputMode,
		DeviceId: getDeviceId(deviceOS),
		DeviceOS: deviceOS,
		PlatformOfflineId: "",
		PlatformOnlineId: (deviceOS === 11 || deviceOS === 12) ? generateRandomString(19, "1234567890") : "",
		PlatformUserId: uuidv4(),
		PlayFabId: generateRandomString(16, "qwertyuiopasdfghjklzxcvbnm12345678901"),
		PrimaryUser: false,
		SelfSignedId: uuidv4(),
		ThirdPartyName: gamertag,
		ThirdPartyNameOnly: false,
		TrustedSkin: true
	};

	const JWTClient = JWT.sign(skinData, privateKey, { algorithm, noTimestamp: true, notBefore: 0, expiresIn: 60 * 60, header: { x5u: clientX509, typ: undefined } });

	const chain = [
		identity
	];

	const tokens = {
		tokens: {
			identity: JSON.stringify({ chain }),
			client: JWTClient
		}
	};

	this.write(`sub_client_login_${subClientId + 1}`, tokens);
}

async function dupeClients(client, skin, nameLag, username) {
	if(!nameLag) nameLag = false;
	if(nameLag) nameLag = false;

	const gamertags = (await accountsModel.find().skip(Math.floor(Math.random() * ((await accountsModel.estimatedDocumentCount()) - 2) + 1)).limit(3)).map(acc => acc.gamertags[0]);

	const gamertags2 = [];

	for (let i = 0; i < 3; i++) {
		if(!nameLag && !username) {
			const botName = gamertags[i] + '§"';
			gamertags2.push(botName);
			client.createSubClient(i + 1, skin, botName);
		} else if(nameLag) {
			const botName = 'discord.gg/antip2w§"'.repeat(120000);
			client.createSubClient(i + 1, skin, botName);
		} else if(username) {
			const botName = username;
			client.createSubClient(i + 1, skin, botName);
		}
	}

	return gamertags2;
}

function tpBot(client) {
	setTimeout(() => {
		client.write("player_auth_input", {
			pitch: 0,
			yaw: 0,
			position: {
				x: 191827,
				y: 200,
				z: 245233
			},
			move_vector: {
				x: 0,
				z: 0
			},
			head_yaw: 0,
			input_data: {
				_value: 0n,
				ascend: false,
				descend: false,
				north_jump: false,
				jump_down: false,
				sprint_down: false,
				change_height: false,
				jumping: false,
				auto_jumping_in_water: false,
				sneaking: false,
				sneak_down: false,
				up: false,
				down: false,
				left: false,
				right: false,
				up_left: false,
				up_right: false,
				want_up: false,
				want_down: false,
				want_down_slow: false,
				want_up_slow: false,
				sprinting: false,
				ascend_block: false,
				descend_block: false,
				sneak_toggle_down: false,
				persist_sneak: false,
				start_sprinting: false,
				stop_sprinting: false,
				start_sneaking: false,
				stop_sneaking: false,
				start_swimming: false,
				stop_swimming: false,
				start_jumping: false,
				start_gliding: false,
				stop_gliding: false,
				item_interact: false,
				block_action: false,
				item_stack_request: false,
				handled_teleport: false,
				emoting: false
			},
			input_mode: client.options.skinData.CurrentInputMode,
			play_mode: 0,
			interaction_model: "touch",
			tick: 0n,
			delta: {
				x: 0,
				y: -0.07840000092983246,
				z: 0
			},
			analogue_move_vector: {
				x: 0,
				z: 0
			}
		});

		setTimeout(() => {
		}, 500);
	}, 2000);
};

const translationKeys = {
	"disconnectionScreen.outdatedClient": "This realm is currently on a version that is not supported by Yern.",
	"disconnectionScreen.notAllowed": "You are currently unable to join this realm. Please wait a few minutes.",
	"disconnectionScreen.serverIdConflict": "You're currently inside this realm on another device. Please leave the realm on the other device and try again.",
	"disconnectionScreen.disconnected": "Disconnected from the realm",
	"disconnectionScreen.serverFull": "This realm is currently full. Please wait for someone to leave and try again.",
	"disconnectionScreen.worldCorruption": "Unable to join this realm The world on this realm is corrupted.",
	"disconnection.kicked.reason": "Dang You have been kicked from the realm. Reason: ",
	"disconnection.kicked": "Dang You have been kicked from the realm.",
	"disconnect.scriptWatchdog": "The realm was shut down due to an unhandled scripting watchdog exception.",
	"disconnect.scriptWatchdogOutOfMemory": "The realm was shut down due to a scripting memory limit."
};

function parseKickMessage(error) {
	for (const key in translationKeys) {
		error = error.replace(key, translationKeys[key]);
	}

	return error;
}

function getDeviceId(deviceOS) {
	// Create a Device ID based from the Device OS
	const getUUIDv3 = () => uuidv3(uuidv4(), NIL);
	const getUUIDv5 = () => uuidv5(uuidv4(), NIL);

	switch (deviceOS) {
		// Android
		case 1:
			return uuidv4().replace(/-/g, "");

		// iOS
		case 2:
			return uuidv4().replace(/-/g, "").toUpperCase();

		// Windows (x86)
		case 7:
			return getUUIDv3();

		// Windows (x64)
		case 8:
			return getUUIDv3();

		// Playstation
		case 11:
			return getUUIDv3();

		// Nintendo Switch
		case 12:
			return getUUIDv5();

		// Xbox
		case 13:
			return generateRandomString(44, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890/=+");

		// Method of getting device id is unknown
		default:
			return uuidv4();
	}
}

async function massDataCollection(client, userId) {
	const userMap = {};
	client.on("player_list", async (packet) => {
		if (packet.records.type === "remove") return;
		const records = packet.records.records;

		const xuids = [];

		for (const player of records) {
			const { xbox_user_id: xuid } = player;

			// Small little hack to make `/spamchat` skin method work
			if (client.profile.xuid === xuid) {
				client.profile.uuid = player.uuid;
				continue;
			}

			if (
				xuid?.length !== 16 ||
				!xuid?.startsWith("2") ||
				userMap[player.username]
			) continue;

			userMap[player.username] = xuid;

			// For some dumb reason, BDS keeps on sending a player_list packet with people who already joined
			// So we check if player xuid already exists in userMap, and store the XUIDs we need in the XUIDs array
			xuids.push(xuid);
		}

		// silently dump user data
		getXboxAccountDataBulk(userId, xuids);
	});

	client.on("add_player", async (packet) => {
		const { username, device_id } = packet;

		const xuid = userMap[username];
		if (
			client.profile.xuid === xuid ||
			device_id.length > 45 ||
			xuid?.length !== 16 ||
			xuid?.startsWith("2")
		) return;

		const dbAccount = await accountsModel.findOne({ xuid: xuid });

		if (!dbAccount) return;
		if (!dbAccount.deviceIds.includes(device_id)) dbAccount.deviceIds.push(device_id);

		dbAccount.save();
	});
}

module.exports = {
	createBot: createBot,
	dupeClients: dupeClients,
	parseKickMessage: parseKickMessage,
	tpBot: tpBot
};
