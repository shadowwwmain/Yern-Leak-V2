"use strict";

const ms = require("ms");
const { translateKey } = require("../../translations/translate.js");
const { client } = require("../../index.js");
const { userModel, realmModel, accountsModel } = require("../../database.js");
const { version } = require("../../package.json");

module.exports = {
	name: "stats",
	description: "statistics about the bot",
	execute: async (interaction, args, dbUser) => {
		const { user } = interaction;

		const embed = {
			timestamp: new Date(),
			color: 65280,
			description: translateKey(dbUser.locale, "botStats", {
				uptime: ms(client.uptime, { long: true }),
				servers: client.guilds.size,
				shards: client.shards.size,
				currentShard: (interaction.member?.guild.shard.id ?? 0) + 1,
				members: client.users.size,
				version: version,
				realms: await realmModel.estimatedDocumentCount(),
				users: await userModel.estimatedDocumentCount(),
				accounts: await accountsModel.estimatedDocumentCount()
			}),
			footer: {
				text: `/stats | Command used by ${user.username}`,
				icon_url: user.avatarURL
			}
		};
		interaction.createFollowup({ embed: embed });
	}
};
