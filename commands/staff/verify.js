"use strict";

const { userModel, createUserDefaults } = require("../../database.js");

module.exports = {
	name: "verify",
	description: "Management of verification",
	options: [
		{
			type: 1,
			name: "set",
			description: "verification status of a user",
			options: [
				{
					type: 6,
					name: "user",
					description: "user to query",
					required: true
				},
				{
					type: 5,
					name: "status",
					description: "Should the user be verified or not?",
					required: true
				}
			]
		},
		{
			type: 1,
			name: "query",
			description: "status on user verification",
			options: [
				{
					type: 6,
					name: "user",
					description: "user to query",
					required: true
				}
			]
		},
		{
			type: 1,
			name: "setall",
			description: "verification status of everybody",
			options: [
				{
					type: 5,
					name: "status",
					description: "should the user be verified or not",
					required: true
				}
			]
		}
	],
	staffOnly: true,
	execute: async (interaction, args) => {
		const { user } = interaction;

		const { sub_command } = args;

		const userId = args.user ?? user.id;

		const dbUser = await userModel.findOne({ id: userId }) ?? createUserDefaults({ id: userId });
		
		if (sub_command === "set") {
			dbUser.verified = args.status;
			await dbUser.save();

			interaction.createFollowup({ content: `<@${userId}> (${userId})'s verification status has been updated to ${args.status}.` });
		} else if (sub_command === "query") {
			interaction.createFollowup({ content: `This user is ${dbUser.verified ? "**verified**" : "**is not verified**"}.` });
		} else if (sub_command === "setall") {
			const status = args.status;
			const allUsers = await userModel.find({ verified: !status, blacklisted: false });

			const msg = await interaction.createFollowup({ content: `Changing the verification status of ${allUsers.length} users. This will take some time...` });

			for (const user of allUsers) {
				user.verified = status;
				user.save();
			}

			msg.edit({ content: `Successfully set the verification status of ${allUsers.length} to ${status}.` });
		}
	}
};
