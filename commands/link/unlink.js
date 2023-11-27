"use strict";

const { userModel } = require("../../database.js");

const end = "<:end:1171524397840990269>";

module.exports = {
	name: "unlink",
	description: "unlink your account",
	options: [
		{
			type: 6,
			name: "user",
			description: "the user to have their account unlinked (staff)"
		}
	],
	requireLink: true,
	execute: async (interaction, args, dbUser) => {
		const user = (args.user && dbUser.staff) ? await userModel.findOne({ id: args.user }) : dbUser;

		let emptyInformation = Object.keys(user.linkData).length === 0

		if (emptyInformation) {
			const embed = {
				title: "<:4746microsoft:1170320819323404308> Account Unlinked",
				timestamp: new Date(),
				color: 16729871,
				description: `${end} <:error:1170321352587219024> You do not have an account linked, you can link one by using </link:1169741451618422846>`
			};
	
			interaction.createFollowup({ embed: embed });
		} else if (!emptyInformation) {
			const embed = {
				title: "<:4746microsoft:1170320819323404308> Account Unlinked",
				timestamp: new Date(),
				color: 65280,
				description: `${end} <:success:1170321325886287882> Account is unlinked successfully.`
			};

			user.realmsCrashLoop = [];
			user.didLink = false;
			user.linkData = {};
			user.save();
	
			interaction.createFollowup({ embed: embed });
		}
	}
};