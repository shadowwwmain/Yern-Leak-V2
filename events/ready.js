"use strict";

const fs = require("node:fs");
const { client } = require("../index.js");
const { userModel } = require("../database.js");
const { logs_channel } = require("../data/config.json");

client.once("ready", async () => {
	console.log(`Yern has gone online! Logged in as ${client.user.username}#${client.user.discriminator} (${client.user.id})`);

	const commands = [];

	client.commands.forEach((cmd) => {
		if (!cmd.name) throw TypeError(`${cmd.name} is missing the "name" value.`);
		if (cmd.description?.length > 100) throw SyntaxError(`${cmd.name}'s description is over 100 characters long.`);

		if (cmd.description.length > 100) console.log(cmd.name);

		commands.push({
			name: cmd.name,
			description: cmd.description ?? "No description available.",
			options: cmd.options,
			dm_permission: cmd.dm_permission,
			nsfw: cmd.nsfw
		});

		// delete options since its no longer ever needed
		cmd.options = undefined;
	});

	client.bulkEditCommands(commands);

	client.editStatus("online", {
		name: "around /w P2W Realms",
		type: 0
	});

	// Leave all guilds with a blacklisted owner
	for (const g of client.guilds) {
		const guild = g[1];

		const serverOwner = await userModel.findOne({ id: guild.ownerID, blacklisted: true });
		if (!serverOwner) continue;

		let invite;
		try {
			invite = `https://discord.gg/${(await guild.channels.random().createInvite()).code}`;
		} catch {
			invite = "Unable to get invite";
		}

		const embed = {
			title: "Threat Mitigation Alert",
			timestamp: new Date(),
			color: 16729871,
			description: `
				Bot is inside a server with blacklisted owner.
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

		guild.leave();
	}

	// Once the bot client initializes, start running all the watchers
	const eventFiles = fs
		.readdirSync("./watchers/")
		.filter(file => file.endsWith(".js"));

	for (const event of eventFiles) {
		require(`../watchers/${event}`);
	}
});
