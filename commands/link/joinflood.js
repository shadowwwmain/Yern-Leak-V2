"use strict";

const devices = require("../../data/devices.json");
const { getRealmData, getRealmAddress } = require("../../common/realms.js");
const { createBot, dupeClients, parseKickMessage, tpBot } = require("../../common/bp-dp.js");
const { realmModel, createRealmDefaults } = require("../../database.js");

const check = "<:success:1170321325886287882>";
const cross = "<:error:1170321352587219024>";
const loading = "<a:loading:1170321149759074355>";
const none = ":black_circle:";

const reply = "<:reply:1171524464761126942>";
const end = "<:end:1171524397840990269>";

const floodStatus = new Map();

module.exports = {
	name: "joinflood",
	description: "Make a bunch of accounts repeatedly join/leave a realm (Requires a linked account)",
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
			description: "Whether or not message logs during the test should be posted."
		},
		{
			type: 4,
			name: "time",
			description: "How long to flood for (in seconds)",
			min_value: 1,
			max_value: 1800
		},
		{
			type: 3,
			name: "username",
			description: "the username of the sub clients",
			min_length: 1,
			max_length: 512
		},
		{
			type: 4,
			name: "delay",
			description: "The delay of players joining and leaving",
			min_value: 0,
			max_value: 540000
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
		const { code: realmCode, device_os } = args;
		let { capture_chat_log, username } = args;

		if (floodStatus.get(user.id) >= 1) return interaction.createFollowup("You currently have an instance of this command running. Please wait for that to end and try again.");
		floodStatus.set(user.id, 1);

		if (typeof capture_chat_log === "undefined") capture_chat_log = true;

		const embed = {
			title: "Join Flood",
			description: `${reply} ${loading} Connecting to realm\n${end} ${none} Flooding player joins`,
			timestamp: new Date(),
			color: 65280,
			footer: {
				text: `/joinflood | Command used by ${user.username}`,
				icon_url: user.avatarURL
			}
		};

		const msg = await interaction.createFollowup({
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
			embed.description = `${reply} ${cross} Connecting to realm\n${reply} ${none} Flooding player joins\n${end} Error Log: ${realmData.errorMsg}`;

			msg.edit({ embed: embed, components: [] });
			return floodStatus.delete(user.id);
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
			embed.description = `${reply} ${cross} Connecting to realm\n${reply} ${none} Flooding player joins\n${end} Error Log: Realm is whitelisted.`;

			msg.edit({ embed: embed, components: [] });
			return floodStatus.delete(user.id);
		}

		const address = await getRealmAddress(realmData.id, accountID);

		if (address.errorMsg) {
			embed.color = 16729871;
			embed.description = `${reply} ${cross} Connecting to realm\n${reply} ${none} Flooding player joins\n${end} Error Log: ${address.errorMsg}`;

			msg.edit({ embed: embed, components: [] });
			return floodStatus.delete(user.id);
		}

		const time = args.time ?? 1800;
		const delay = args.delay ?? 0;
		let interval;
		let chat_log = "";

		const client = createBot(address, device_os, dbUser);

		client.on("play_status", (data) => {
			if (data.status !== "login_success") return;

			embed.description = `${reply} ${check} Connecting to realm\n${reply} ${loading} Flooding player joins\n${end} Operation ends <t:${Math.floor(Date.now() / 1000) + time}:R>.`;
			msg.edit({ embed: embed });

			interval = setInterval(() => {

				dupeClients(client, dbUser.skin, false, username);

				client.write(`disconnect_${Math.floor(Math.random() * (5 - 2 + 1) + 2)}`, {
					hide_disconnect_screen: false,
					message: "Client leaving"
				});

				// Join Flood cancelled
				if (floodStatus.get(user.id) === 2) {
					embed.description = `${reply} ${check} Connecting to realm\n${reply} ${check} Flooding player joins\n${end} Operation has been cancelled.`;
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
					return floodStatus.delete(user.id);
				}

				// Join Flood not active
				if (floodStatus.get(user.id) === 0) {
					client.disconnect();
					return clearInterval(interval);
				}
			}, delay);

			// Join Flood is done
			setTimeout(() => {
				if (floodStatus.get(user.id) !== 1) {
					client.disconnect();
					return clearInterval(interval);
				}

				clearInterval(interval);
				client.disconnect();

				embed.description = `${reply} ${check} Connecting to realm\n${reply} ${check} Flooding player joins\n${end} Operation Complete.`;

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
				floodStatus.delete(user.id);
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
			embed.description = `${reply} ${check} Connecting to realm\n${reply} ${cross} Flooding player joins\n${end} Error Log: ${parseKickMessage(reason.message)}`;

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

			floodStatus.delete(user.id);
		});
	},
	componentPressEvent: cancelFlood
};

async function cancelFlood(interaction) {
	const { user } = interaction;

	if (!floodStatus.get(user.id)) {
		return interaction.createMessage({
			content: "This operation has already ended.",
			flags: 64
		});
	}

	interaction.acknowledge();

	floodStatus.set(user.id, 2);
}