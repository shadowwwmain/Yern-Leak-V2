"use strict";

const { guildModel, createGuildDefaults } = require("../../database.js");

module.exports = {
	name: "verify-role",
	description: "Set the role used for verification",
	dm_permission: false,
	options: [
		{
			type: 1,
			name: "set",
			description: "Set the verification role",
			options: [
				{
					type: 8,
					name: "role",
					description: "What role to give to verified users",
					min_value: 1,
					max_value: 30
				}
			]
		},
		{
			type: 1,
			name: "query",
			description: "Query the role that is given to members when they verify"
		}
	],
	staffOnly: true,
	execute: async (interaction, args) => {
		const guildId = interaction.channel.guild.id;

		let dbGuild = await guildModel.findOne({id: guildId});

		if(!dbGuild) {
			dbGuild = createGuildDefaults({id: guildId});
		}

		const { sub_command, role } = args;
		if(sub_command === "set") {
			dbGuild.memberRole = role;
			await dbGuild.save();

			interaction.createFollowup({content:`Successfully set the member role to <@&${role}>`});
		} else if (sub_command === "query") {
			interaction.createFollowup({content: dbGuild.memberRole ? `The member role on this server is set to <@${dbGuild.memberRole}>` : "This server does not have a verification role set."});
		}
	}
};
