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

const spamStatus = new Map();

const colorcodes = () => { return "§l§n§" + generateRandomString(1, "abcdef1234567890"); };

module.exports = {
	name: "spamchat",
	description: "flood the chat of a p2w realm with a custom message.",
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
			type: 4,
			name: "time",
			description: "how long to spam messages for (in seconds)?",
			min_value: 1,
			max_value: 1800
		},
		{
			type: 3,
			name: "message",
			description: "the text to spam",
			min_length: 1,
			max_length: 508
		},
		{
			type: 4,
			name: "random_string_length",
			description: "additional text to add to the message to bypass anti-spam",
			min_value: 0,
			max_value: 100
		},
		{
			type: 4,
			name: "send_message_delay",
			description: "the delay to send packets",
			min_value: 0,
			max_value: 540000
		},
		{
			type: 4,
			name: "source",
			description: "what method should be used to send messages",
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
					name: "Sleep Spam",
					value: 3
				},
				/*
				// emoting with bedrock-protocol doesnt work
				{
					name: "Emote Spam",
					value: 4
				}
				*/
				{
					name: "Skin Change Spam (Persona)",
					value: 5
				},
				{
					name: "Skin Change Spam (Non-Persona)",
					value: 6
				},
				{
					name: "/tell (External)",
					value: 7
				},
				{
					name: "Text (Sub client only)",
					value: 8
				}
			]
		},
		{
			type: 5,
			name: "capture_chat_log",
			description: "whether or not upload message logs during the test."
		},
		{
			type: 5,
			name: "dupe",
			description: "whether or not to spam random accounts to spam along."
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
		const { code: realmCode, random_string_length: stringLength, device_os } = args;
		let { capture_chat_log, dupe } = args;
		const source = args.source ?? 2;

		if (spamStatus.get(user.id) >= 1) return interaction.createFollowup("You currently have an instance of this command running. Please wait for that to end and try again.");
		spamStatus.set(user.id, 1);

		let alerts = "";

		if (typeof capture_chat_log === "undefined") capture_chat_log = true;
		if (typeof dupe === "undefined") dupe = true;

		if (source != 7 && source != 8 && source >= 3 && args.message) alerts = `:warning: You chose to have a custom message to spam, but you selected the spam source to something that does not support it. :warning:\n`;

		const embed = {
			title: "Chat Spam",
			description: `${reply} ${loading} Connecting to realm\n${end} ${none} Sending chat packets`,
			timestamp: new Date(),
			color: 65280,
			footer: {
				text: `/spamchat | Command used by ${user.username}`,
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
			embed.description = `${reply} ${cross} Connecting to realm\n${reply} ${none} Sending chat packets\n${end} Error Log: ${realmData.errorMsg}`;

			msg.edit({ embed: embed, components: [] });

			return spamStatus.delete(user.id);
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
			embed.description = `${reply} ${cross} Connecting to realm\n${reply} ${none} Sending chat packets\n${end} Error Log: Realm is whitelisted.`;

			msg.edit({ embed: embed, components: [] });

			return spamStatus.delete(user.id);
		}

		const address = await getRealmAddress(realmData.id, accountID);

		if (address.errorMsg) {
			embed.color = 16729871;
			embed.description = `${reply} ${cross} Connecting to realm\n${reply} ${none} Sending chat packets\n${end} Error Log:\n${address.errorMsg}`;

			msg.edit({ embed: embed, components: [] });

			return spamStatus.delete(user.id);
		}

		const time = args.time ?? (dbUser.premium ? 1800 : 300);
		const message = args.message ?? getRandomMessage();
		const message_delay = args.send_message_delay ?? 50;

		const emotes = [
			"5d45037f-0003-5cce-4db5-27492e35f1aa",
			"cd472edf-10e7-8a4c-673d-1af27bcc4d81",
			"a94b3bc8-619a-469a-8205-4364bebd07b5",
			"a14e1338-4c8c-4217-caaf-832fa3d6a9b3"
		];

		let messageCount = 0;
		let interval = 20;
		let chat_log = "";

		const client = createBot(address, device_os, dbUser);

		client.on("start_game", (packetData) => {
			embed.description = `${reply} ${check} Connecting to realm\n${reply} ${loading} Sending chat packets\n${reply} Chat is being spammed.\n${end} Operation ends <t:${Math.floor(Date.now() / 1000) + time}:R>.`;
			msg.edit({ embed: embed });

			if (dupe) dupeClients(client, dbUser.skin);

			tpBot(client)

			let action_packet;
			if (source === 4) {
				action_packet = {
					runtime_entity_id: packetData.runtime_entity_id,
					position: { x: 0, y: 0, z: 0 },
					result_position: { x: 0, y: 0, z: 0 },
					face: 0
				};

				client.write("emote_list", {
					player_id: packetData.runtime_entity_id,
					emote_pieces: emotes
				});
			}

			let skinData;
			if (source === 5 || source == 6) {
				skinData = {
					uuid: client.profile.uuid,
					skin: require("../../data/skin_spam_steve.json"),
					skin_name: "",
					old_skin_name: "",
					is_verified: true
				};

				// tailor the skin to the player
				const playFabId = client.options.skinData.PlayFabId;

				skinData.skin.skin_id = `persona-${playFabId}-0`;
				skinData.skin.play_fab_id = playFabId;
				skinData.skin.full_skin_id = `persona-${playFabId}-0`;
				skinData.skin.skin_resource_pack.replaceAll("<playfab_id>", playFabId);
				skinData.skin.geometry_data.replaceAll("<playfab_id>", playFabId);

				skinData.skin.persona = source === 5 ? true : false;
			}

			interval = setInterval(() => {
				const message2 = stringLength ? `${message} ${generateRandomString(stringLength)}` : message;

				switch (source) {
					// Text spam
					case 0:
						client.sendMessage(`${colorcodes()}` + message2 + ' | .gg/antip2w');

						if (dupe) {
							client.sendMessage2(`${colorcodes()}` + message2 + ' | .gg/antip2w');
							client.sendMessage3(`${colorcodes()}` + message2 + ' | .gg/antip2w');
							client.sendMessage4(`${colorcodes()}` + message2 + ' | .gg/antip2w');
						}
					break;

					// /me spam
					case 1:
						client.sendCommand(`/me ${colorcodes()}${message2} | .gg/antip2w`, 0);
						if (dupe) {
							client.sendCommand2(`/me ${colorcodes()}${message2} | .gg/antip2w`, 0);
							client.sendCommand3(`/me ${colorcodes()}${message2} | .gg/antip2w`, 0);
							client.sendCommand4(`/me ${colorcodes()}${message2} | .gg/antip2w`, 0);
						}
					break;

					// External /me spam
					case 2:
						client.sendCommand(`/me ${colorcodes()}${message2} | .gg/antip2w`, 5);
						if (dupe) {
							client.sendCommand2(`/me ${colorcodes()}${message2} | .gg/antip2w`, 5);
							client.sendCommand3(`/me ${colorcodes()}${message2} | .gg/antip2w`, 5);
							client.sendCommand4(`/me ${colorcodes()}${message2} | .gg/antip2w`, 5);
						}
					break;
					
					// External /tell spam
					case 7:
						client.sendCommand(`/tell @a ${colorcodes()}${message2} | .gg/antip2w`, 5);
						if (dupe) {
							client.sendCommand2(`/tell @a ${colorcodes()}${message2} | .gg/antip2w`, 5);
							client.sendCommand3(`/tell @a ${colorcodes()}${message2} | .gg/antip2w`, 5);
							client.sendCommand4(`/tell @a ${colorcodes()}${message2} | .gg/antip2w`, 5);
						}
					break;

					//Text sub client only
                    case 8:
						if (dupe == "false") dupeClients(client, dbUser.skin)
						client.sendMessage2(`${colorcodes()}` + message2 + ' | .gg/antip2w');
                        client.sendMessage3(`${colorcodes()}` + message2 + ' | .gg/antip2w');
                        client.sendMessage4(`${colorcodes()}` + message2 + ' | .gg/antip2w');
						break;

					// Sleep spam
					case 3: {
						client.write("player_action", {
							...action_packet,

							action: "start_sleeping"
						});

						client.write("player_action", {
							...action_packet,

							action: "stop_sleeping"
						});
						break;
					}

					// Emote spam (Broken)
					case 4: {
						client.write("emote", {
							entity_id: packetData.runtime_entity_id,
							emote_id: emotes[Math.floor(Math.random() * emotes.length)],
							xuid: client.profile.xuid,
							platform_id: client.options.skinData.PlatformOnlineId,
							flags: 1
						});
						break;
					}

					/**
					 * Skin Change Spam
					 * 5 = Persona skin
					 * 6 = Non-Persona Skin
					 */
					case 5:
					case 6: {
						client.write("player_skin", skinData);
						break;
					}
				}
				messageCount++;

				// Spamchat was cancelled
				if (spamStatus.get(user.id) === 2) {
					embed.description = `${reply} ${check} Connecting to realm\n${reply} ${check} Sending chat packets\n${reply} Operation has been cancelled.\n${end} An average of ${(messageCount / time).toFixed(2)} messages was sent per second.`;

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
					return spamStatus.delete(user.id);
				}

				// Spamchat not active
				if (spamStatus.get(user.id) === 0) {
					client.disconnect();
					return clearInterval(interval);
				}
			}, message_delay);

			// Spamchat is done
			setTimeout(() => {
				if (spamStatus.get(user.id) !== 1) {
					client.disconnect();
					return clearInterval(interval);
				}

				clearInterval(interval);
				client.disconnect();

				embed.description = `${reply} ${check} Connecting to realm\n${reply} ${check} Sending chat packets\n${reply} Operation Completed.\n${end} An average of ${(messageCount / time).toFixed(2)} messages was sent per second.`;

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
				spamStatus.delete(user.id);
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
			embed.description = `${check} Getting realm identity\n${check} Connecting to realm\n${cross} Sending chat packets\n\nError Log:\n${parseKickMessage(reason.message)}`;

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

			clearInterval(interval);

			spamStatus.delete(user.id);
		});
	},
	componentPressEvent: cancelSpam
};

async function cancelSpam(interaction) {
	const { user } = interaction;

	if (!spamStatus.get(user.id)) {
		return interaction.createMessage({
			content: "This operation has already ended.",
			flags: 64
		});
	}

	interaction.acknowledge();

	spamStatus.set(user.id, 2);
}

function getRandomMessage() {
	const colorcodes = () => { return "§l§n§" + generateRandomString(1, "abcdef1234567890"); };

	let message = "";
	for (let i = 0; i < 9; i++) {
		message += `${colorcodes()} .gg/antip2w ${colorcodes()} .gg/antip2w `;
	}

	// § is considered as two characters, so instead of substringing it to be 512 characters it has to be 454 (508 characters in total)
	message = message.substring(0, 454);

	return message;
}