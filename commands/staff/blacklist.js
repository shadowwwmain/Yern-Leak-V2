"use strict";

const { userModel, createUserDefaults } = require("../../database.js");

module.exports = {
	name: "blacklist",
	description: "Management of Yern's Blacklisted users.",
	options: [
		{
			type: 1,
			name: "add",
			description: "Add a user to the blacklist",
			options: [
				{
					type: 6,
					name: "user",
					description: "The user to blacklist",
					required: true
				}
			]
		},
		{
			type: 1,
			name: "remove",
			description: "Remove a user from the blacklist",
			options: [
				{
					type: 6,
					name: "user",
					description: "The user to remove the blacklist from",
					required: true
				}
			]
		},
		{
			type: 1,
			name: "query",
			description: "Check if a user is blacklisted",
			options: [
				{
					type: 6,
					name: "user",
					description: "The user to query",
					required: true
				}
			]
		},
		{
			type: 1,
			name: "list",
			description: "Get a list of all blacklisted users"
		}
	],
	staffOnly: true,
	execute: async (interaction, args) => {
		const { user } = interaction;

		const { sub_command } = args;

		const userId = args.user ?? user.id;

		const dbUser = await userModel.findOne({ id: userId }) ?? createUserDefaults({ id: userId });

		if (sub_command === "add") {
			if (dbUser.blacklisted === true) return interaction.createFollowup({ content: "This user is already blacklisted." });

			dbUser.blacklisted = true;
			interaction.createFollowup({ content: `<@!${userId}> (${userId}) has been added to the blacklist.` });
		} else if (sub_command === "remove") {
			if (dbUser.blacklisted === false) return interaction.createFollowup({ content: "This user isn't blacklisted." });

			dbUser.blacklisted = false;
			interaction.createFollowup({ content: `<@!${userId}> (${userId}) has been removed from the blacklist.` });
		} else if (sub_command === "query") {
			interaction.createFollowup({ content: `This user on ${user.blacklisted ? "**is on**" : "**is not**"} the blacklist.` });
			return;
		} else if (sub_command === "list") {
			const blacklistedUsers = await userModel.find({ blacklisted: true });

			let message = "These are the users that are currently blacklisted:\n\n";

			if (blacklistedUsers.length === 0) message += "No users are currently blacklisted.";

			for (const user of blacklistedUsers) {
				message += `<@!${user.id}> - ${user.id}\n`;
			}

			const embed = {
				title: "Blacklisted User List",
				description: message,
				timestamp: new Date(),
				color: 65280,
				footer: {
					text: `/blacklist | Command used by ${user.username} | ${blacklistedUsers.length} users are currently blacklisted.`,
					icon_url: user.avatarURL
				}
			};

			interaction.createMessage({ embed: embed, flags: 64 });

			return;
		}
		await dbUser.save();
	}
};
