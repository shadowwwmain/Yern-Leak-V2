"use strict";

const { userModel, createUserDefaults } = require("../../database.js");

module.exports = {
	name: "staff",
	description: "management of staff permissions",
	options: [
		{
			type: 1,
			name: "set",
			description: "set staff status of a user",
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
					description: "Should the user be staff or not?",
					required: true
				}
			]
		},
		{
			type: 1,
			name: "query",
			description: "the status on user staff",
			options: [
				{
					type: 6,
					name: "user",
					description: "user to query",
					required: true
				}
			]
		}
	],
	staffOnly: true,
	execute: async (interaction, args) => {
		const { user: userId, sub_command } = args;

		const dbUser = await userModel.findOne({ id: userId }) ?? createUserDefaults({ id: userId });

		if (sub_command === "set") {
			dbUser.staff = args.status;
			await dbUser.save();

			interaction.createFollowup({ content: `<@${userId}> (${userId})'s staff has been updated to ${args.status}.` });
		} else if (sub_command === "query") {
			interaction.createFollowup({ content: `The user ${dbUser.staff ? "**has staff**" : "**doesn't have staff**"}.` });
		}
	}
};
