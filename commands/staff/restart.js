"use strict";

const end = "<:end:1171524397840990269>";

module.exports = {
	name: "restart",
	description: "restarts yern",
	staffOnly: true,
	execute: async (interaction) => {
		const { user } = interaction;

		const embed = {
			title: "Yern Bot",
			timestamp: new Date(),
			color: 65280,
			description: `${end} Yern has restarted!`,
			footer: {
				text: `/restart | Command used by ${user.username}`,
				icon_url: user.avatarURL
			}
		};

		await interaction.createFollowup({ embed: embed });

		process.exit(0);
	}
};
