"use strict";

const { client } = require("../index.js");
const { autoPurgeGuilds } = require("../data/config.json");

async function autoPurgeChannels() {
	if(process.env.NODE_ENV === "development") return;

	// Automatically purge channels every 6 hours
	for(const data of autoPurgeGuilds) {
		const { id, time } = data;

		const guild = client.guilds.find(g => g.id === id);

		if(!guild) continue;

		// prevent creating duplicate channels
		const purgedChannels = [];
		for(const c of guild.channels) {
			const channel = c[1];

			if(
				purgedChannels.includes(channel.name) ||
				channel.type !== 0 ||
				!channel.topic?.includes("autopurge=true") ||
				Date.now() - channel.createdAt < time
			) continue;

			purgedChannels.push(channel.name);

			const permissions = [];

			channel.permissionOverwrites.forEach(permission => {
				permissions.push({
					allow: permission.allow,
					deny: permission.deny,
					id: permission.id,
					type: permission.type
				});
			});

			await guild.createChannel(channel.name, channel.type, {
				nsfw: channel.nsfw,
				parentID: channel.parentID,
				permissionOverwrites: permissions,
				position: channel.position,
				rateLimitPerUser: channel.rateLimitPerUser,
				reason: "Yern Auto-Purge",
				topic: channel.topic
			});

			channel.delete("Yern Auto-Purge");
		}
	}
}

// check if channels should be auto-purged every two hours
setInterval(autoPurgeChannels, 7200000);