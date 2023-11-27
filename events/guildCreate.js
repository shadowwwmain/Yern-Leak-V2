"use strict";

const { client } = require("../index.js");
const { userModel } = require("../database.js");
const { logs_channel } = require("../data/config.json");

client.on("guildCreate", async (guild) => {
	const user = await userModel.findOne({ id: guild.ownerID });

	let invite;
	try {
		invite = `https://discord.gg/${(await guild.channels.random().createInvite()).code}`;
	} catch {
		invite = "Unable to get invite";
	}

	if (user?.blacklisted) {
		const embed = {
			title: "Threat Mitigation Alert",
			timestamp: new Date(),
			color: 16729871,
			description: `
				Bot added to server where owner is blacklisted.
				__**Guild Info**__
				Guild Name: ${guild.name}
				Guild ID: ${guild.id}
				Member Count: ${guild.memberCount}
				Owner ID: ${guild.ownerID}
			`,
			thumbnail: {
				url: guild.iconURL
			},
			fields: [
				{
					name: "Invite",
					value: invite
				}
			]
		};
		client.createMessage(logs_channel, { content: "", embed: embed });

		return guild.leave();
	}

	const embed = {
		title: "Threat Mitigation Alert - New Guild Joined",
		timestamp: new Date(),
		color: 65280,
		description: `
			Yern has joined a new guild.
			__**Guild Info**__
			Guild Name: ${guild.name}
			Guild ID: ${guild.id}
			Member Count: ${guild.memberCount}
			Owner ID: ${guild.ownerID}
		`,
		thumbnail: {
			url: guild.iconURL
		},
		fields: [
			{
				name: "Invite",
				value: invite
			}
		]
	};
	client.createMessage(logs_channel, { embed: embed });
});