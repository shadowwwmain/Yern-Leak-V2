"use strict";

require("dotenv").config();

const Eris = require("eris");
const fs = require("node:fs");
const config = require("./data/config.json");

const logs_channel = config.logs_channel;

const client = new Eris(process.env.TOKEN, {
	options: {
		intents: [
			"all"
		],
		disable_events: [
			"CHANNEL_CREATE",
			"CHANNEL_DELETE",
			"CHANNEL_UPDATE",
			"GUILD_BAN_ADD",
			"GUILD_BAN_REMOVE",
			"GUILD_DELETE",
			"GUILD_MEMBER_ADD",
			"GUILD_MEMBER_REMOVE",
			"GUILD_MEMBER_UPDATE",
			"GUILD_ROLE_CREATE",
			"GUILD_ROLE_DELETE",
			"GUILD_ROLE_UPDATE",
			"GUILD_UPDATE",
			"MESSAGE_CREATE",
			"MESSAGE_DELETE",
			"MESSAGE_DELETE_BULK",
			"MESSAGE_UPDATE",
			"PRESENCE_UPDATE",
			"TYPING_START",
			"USER_UPDATE",
			"VOICE_STATE_UPDATE"
		],
		maxShards: "auto"
	}
});

client.config = config;

module.exports = {
	client: client
};

require("./database.js");

const eventFiles = fs
	.readdirSync("./events/")
	.filter(file => file.endsWith(".js"));

for (const event of eventFiles) {
	try {
		require(`./events/${event}`);
	} catch (error) {
		console.error(`Unable to load event: ${event}.\n\nStack: ${error.stack}`);
	}
}

client.commands = new Map();
const commandFolders = fs.readdirSync("./commands");

for (const folder of commandFolders) {
	if (folder === "unused") continue;
	if (folder === "dev" && process.env.NODE_ENV !== "development") continue;

	const commandFiles = fs
		.readdirSync(`./commands/${folder}`)
		.filter(file => file.endsWith(".js"));
	for (const file of commandFiles) {
		let command;
		try {
			command = require(`./commands/${folder}/${file}`);
		} catch (error) {
			console.error(`Unable to load command: ${file}.\n\nStack: ${error.stack}`);

			// events not being run could be bad for the bot, so we restart the bot
			process.exit(1);
		}

		// if command is disabled, dont load its functions to save memory
		if (command.disabled) {
			command.execute = undefined;
			command.componentPressEvent = undefined;
			command.componentSelectEvent = undefined;
		}

		command.category = folder;

		client.commands.set(command.name, command);
	}
}

client.on("error", (error) => {
	if (error.code === 1006) return;
	console.error(error);
});

client.connect();

process.on("warning", (warning) => {
	console.warn(warning);

	const embed = {
		title: "Warning",
		description: `Name: ${warning.name}\nMessage: ${warning.message}\n\nStack:\n\`\`\`${warning.stack}\`\`\``,
		timestamp: new Date(),
		color: 16729871
	};

	client.createMessage(logs_channel, { content: "", embed: embed });
});

process.on("unhandledRejection", (error) => {
	if ([10062, 50001, 10003].includes(error.code) || error.stack.includes("Authentication failed, timed out")) return;

	console.error(error);

	const embed = {
		title: "Unhandled Rejection",
		description: error.stack,
		timestamp: new Date(),
		color: 16729871
	};

	client.createMessage(logs_channel, { content: "", embed: embed });
});

process.on("uncaughtException", (error, origin) => {
	console.error(error);

	const embed = {
		title: "Uncaught Exception",
		description: `Error: ${error}\nOrigin: ${origin}`,
		timestamp: new Date(),
		color: 16729871
	};

	client.createMessage(logs_channel, { content: "", embed: embed });

	// Nodejs is in a critical state, reboot.
	process.exit(0);
});

// Auto-patch mcdata protocol files
const version = "1.20.40";

const protocol = require(`./node_modules/minecraft-data/minecraft-data/data/bedrock/${version}/protocol.json`);

protocol._patched = false;

if (!protocol._patched) {
	const packetIDs = protocol.types.mcpe_packet[1][0].type[1].mappings;
	const packets = protocol.types.mcpe_packet[1][1].type[1].fields;

	for (let subClientId = 2; subClientId < 5; subClientId++) {
		const subPacketId = 4096 * (subClientId - 1);

		packetIDs[`${5 + subPacketId}`] = `disconnect_${subClientId}`;
		packetIDs[`${9 + subPacketId}`] = `text_${subClientId}`;
		packetIDs[`${11 + subPacketId}`] = `start_gane_${subClientId}`;
		packetIDs[`${36 + subPacketId}`] = `player_action_${subClientId}`;
		packetIDs[`${77 + subPacketId}`] = `command_request_${subClientId}`;
		packetIDs[`${94 + subPacketId}`] = `sub_client_login_${subClientId}`;
		packetIDs[`${144 + subPacketId}`] = `player_auth_input_${subClientId}`;
		packetIDs[`${185 + subPacketId}`] = `request_permissions_${subClientId}`;

		packets[`disconnect_${subClientId}`] = "packet_disconnect";
		packets[`text_${subClientId}`] = "packet_text";
		packets[`start_game_${subClientId}`] = "packet_start_game";
		packets[`player_action_${subClientId}`] = "packet_player_action";
		packets[`command_request_${subClientId}`] = "packet_command_request";
		packets[`sub_client_login_${subClientId}`] = "packet_sub_client_login";
		packets[`player_auth_input_${subClientId}`] = "packet_player_auth_input";
		packets[`request_permissions_${subClientId}`] = "packet_request_permissions";
	}
	protocol._patched = true;
	fs.writeFileSync(`./node_modules/minecraft-data/minecraft-data/data/bedrock/${version}/protocol.json`, JSON.stringify(protocol, null, 2));
}