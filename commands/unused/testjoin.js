"use strict";

const fetch = require("node-fetch");
const { userModel } = require("../../database.js");

const client_id = "1078040435328561264";
const client_secret = "ieTIbBnDMSZ8VTwprI8ABUoaanwW89UZ";

module.exports = {
	name: "testjoin",
	description: "Test tge Oauth2 guilds.join by making an account join a test server.",
	options: [
		{
			type: 3,
			name: "guild_id",
			description: "The guild to leave.",
			required: true,
			min_length: 18,
			max_length: 19
		},
		{
			type: 6,
			name: "user",
			description: "The user that should join the guild",
			required: true
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
		const user = await userModel.findOne({ id: args.user });

		const oauth2Data = user.oauth2Data;

		if (!oauth2Data) return interaction.createFollowup({ content: "No oauth2 data was found. Most likely the user never verified." });

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
				const errorlog = `${tokenResponse.status} ${JSON.stringify(tokenData)}`;
				interaction.createFollowup({ content: `Error while refreshing auth token:\n${errorlog}` });
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
			interaction.createFollowup({ content: "User has been added to the guild." });
		} else if (joinResponse.status === 204) {
			interaction.createFollowup({ content: "User is already inside this guild." });
		} else {
			const errorlog = `${joinResponse.status} ${JSON.stringify(await joinResponse.json())}\n`;
			interaction.createFollowup({ content: `Error while refreshing auth token:\n${errorlog}` });
		}
	}
};
