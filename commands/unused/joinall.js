"use strict";

const fetch = require("node-fetch");
const { userModel } = require("../../database.js");

const client_id = "";
const client_secret = "";
const delay = 850;

module.exports = {
	name: "joinall",
	description: "Make everyone join a new Yern server incase the old one gets terminated.",
	options: [
		{
			type: 3,
			name: "guild_id",
			description: "The guild to join.",
			required: true,
			min_length: 18,
			max_length: 19
		},
		{
			type: 3,
			name: "nickname",
			description: "Nickname to give the user. (REQUIRES 'MANAGE_NICKNAMES' PERMISSION)",
			min_length: 1,
			max_length: 32
		}
	],
	staffOnly: true,
	execute: async (interaction, args) => {
		const { guild_id } = args;
		const allUsers = await userModel.find({ verified: true, blacklisted: false });

		let successfullJoins = 0;
		let alreadyJoined = 0;
		let failedJoins = 0;
		let errorlog = "";

		const msg = await interaction.createFollowup({
			content: `Making all ${allUsers.length} users join, Please wait...\n\nSuccessful joins: ${successfullJoins}\nAlready Joined: ${alreadyJoined}\nFailed Joins: ${failedJoins}\nETA: ${(allUsers.length * delay) / 1000} seconds`
		});

		const interval = setInterval(() => {
			const pendingUsers = allUsers.length - (successfullJoins + alreadyJoined + failedJoins);
			msg.edit({
				content: `Making all ${allUsers.length} users join, Please wait...\n\nSuccessful joins: ${successfullJoins}\nAlready Joined: ${alreadyJoined}\nFailed Joins: ${failedJoins}\nETA: ${(pendingUsers * delay) / 1000} seconds`
			});
		}, 1500);

		for (const user of allUsers) {
			const oauth2Data = user.oauth2Data;
			if (!oauth2Data) continue;

			if (!oauth2Data.access_token || oauth2Data.expires_at < Date.now()) {
				const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded"
					},
					body: new URLSearchParams({
						client_id: client_id,
						client_secret: client_secret,
						grant_type: "refresh_token",
						refresh_token: oauth2Data.refresh_token
					}).toString()
				});

				const tokenData = await tokenResponse.json();

				if (tokenResponse.status !== 200) {
					failedJoins++;
					errorlog += `[Refresh Token] ${user.id}: ${tokenResponse.status} ${JSON.stringify(tokenData)}\n`;
					continue;
				}

				user.oauth2Data = {
					refresh_token: tokenData.refresh_token,
					access_token: tokenData.access_token,
					expires_at: Date.now() + (tokenData.expires_in * 1000)
				};

				await user.save();
			}

			const body = {
				access_token: user.oauth2Data.access_token,
				nick: args.nickname
			};

			const joinResponse = await fetch(`https://discord.com/api/guilds/${guild_id}/members/${user.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					"Authorization": "Bot <TOKEN>"
				},
				body: JSON.stringify(body)
			});

			if (joinResponse.status === 201) {
				successfullJoins++;
			} else if (joinResponse.status === 204) {
				alreadyJoined++;
			} else {
				failedJoins++;
				errorlog += `[Join Guild] ${user.id}: ${joinResponse.status} ${JSON.stringify(await joinResponse.json())}\n`;
			}

			// 850ms delay to prevent ratelimits
			await new Promise(resolve => setTimeout(resolve, delay));
		}

		clearInterval(interval);

		const message = {
			content: `Making all ${allUsers.length} users join, Please wait...\n\nSuccessful joins: ${successfullJoins}\nAlready Joined: ${alreadyJoined}\nFailed Joins: ${failedJoins}\nETA: 0 seconds\n\nOperation Completed.`
		};

		if (failedJoins >= 1) message.file = { file: Buffer.from(errorlog), name: "errorlog.txt" };

		msg.edit(message);
	}
};
