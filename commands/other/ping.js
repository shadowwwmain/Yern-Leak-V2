"use strict";

const { translateKey } = require("../../translations/translate.js");
const { client } = require("../../index.js");

const reply = "<:reply:1171524464761126942>";
const end = "<:end:1171524397840990269>";

module.exports = {
	name: "ping",
	description: "get bot's ping.",
	execute: async (interaction, args, dbUser) => {
		const { user } = interaction;

		const currentTime = Date.now();

		const msg = await interaction.createFollowup({ content: translateKey(dbUser.locale, "pleaseWait") });

		let message = `${reply} ${translateKey(dbUser.locale, "botPing", { ping: Date.now() - currentTime })}`;

		for (const i of client.shards) {
			const shard = i[1];

			message += `${end} **Shard ${shard.id + 1}**: \`${shard.lastHeartbeatReceived - shard.lastHeartbeatSent}ms\`\n`;
		}

		const embed = {
			title: translateKey(dbUser.locale, "botPingTitle"),
			timestamp: new Date(),
			color: 65280,
			description: message,
			footer: {
				text: `/ping | Command used by ${user.username}`,
				icon_url: user.avatarURL
			}
		};

		msg.edit({ content: "", embed: embed });
	}
};
