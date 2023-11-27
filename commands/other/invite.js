"use strict";

const reply = "<:reply:1171524464761126942>";
const end = "<:end:1171524397840990269>";

module.exports = {
	name: "invite",
	description: "get invite link",
	execute: async (interaction, args, dbUser) => {
		const { user } = interaction;

		const embed = {
			title: "Yern Invite",
			timestamp: new Date(),
			color: 65280,
			description: `${reply} **Support Server**\n${end} https://discord.gg/antip2w`,
			footer: {
				text: `/invite | Command used by ${user.username}`,
				icon_url: user.avatarURL
			}
		};

		interaction.createFollowup({ embed: embed });
	}
};
