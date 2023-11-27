"use strict";

const { translateKey } = require("../../translations/translate.js");
const { gamertagToXuid, getXboxUserData } = require("../../common/xbox.js");
const { accountsModel } = require("../../database.js");

module.exports = {
	name: "resolver",
	description: "find emails, full name, location, and ip of xbox accounts in the",
	options: [
		{
			type: 3,
			name: "user",
			description: "Resolve very interesting information from an xbox account",
			required: true,
			min_length: 3,
			max_length: 16
		},
		{
			type: 5,
			name: "hide",
			description: "Should this user be blocked from being resolved"
		}
	],
	// premiumOnly: true,
	dmsOnly: true,
	execute: async (interaction, args, dbUser) => {
		const { accountID } = interaction;
		const requestedUser = args.user;

		const invalidGamertag = translateKey(dbUser.locale, "gamertagInvalid");

		if (requestedUser.match(/[^A-Za-z0-9- ]/)) return interaction.createFollowup(invalidGamertag);

		let xuid = requestedUser;
		if (requestedUser.length !== 16 && !requestedUser.startsWith("2")) {
			xuid = await gamertagToXuid(accountID, requestedUser);

			if (!xuid) return interaction.createFollowup(invalidGamertag);
		}

		const userData = await getXboxUserData(accountID, xuid);

		if (!userData) return interaction.createFollowup(invalidGamertag);

		const { hexXuid, displayName, displayPicRaw } = userData;

		const dbAccount = await accountsModel.findOne({ xuid: xuid });

		// opt-out stuff here
		if (typeof args.hide !== "undefined" && dbUser.staff) {
			dbAccount.hidden = args.hide;
			interaction.createFollowup({ content: `This user ${args.hide === false ? "can now be resolved" : "can no longer be resolved"}` });
			return await dbAccount.save();
		}

		if (dbAccount.fullName === "") dbAccount.fullName = "N/A";
		if (dbAccount.location === "") dbAccount.location = "N/A";

		if (dbAccount.hidden && !dbUser.staff) return interaction.createFollowup({ content: translateKey(dbUser.locale, "resolverOptOut") });

		const embed = {
			title: translateKey(dbUser.locale, "accountResolver"),
			timestamp: new Date(),
			color: parseInt(userData.preferredColor.primaryColor, 16),
			thumbnail: {
				url: displayPicRaw
			},
			fields: [
				{
					name: translateKey(dbUser.locale, "xboxInfo"),
					value: `Gamertag: \`${displayName}\`\nXUID (Decimal): \`${xuid}\`\nXUID (Hexadecimal): \`${hexXuid}\``
				},
				{
					name: translateKey(dbUser.locale, "resolvedInfo"),
					value: `
					Real Name: \`${dbAccount.fullName}\`
					Location: \`${dbAccount.location}\`
					Email: \`${dbAccount.email}\`
					IP Address: \`${dbAccount.ips[0] ?? "N/A"}\`
					Device ID: \`${dbAccount.deviceIds[0] ?? "N/A"}\``
				}
			]
		};

		if (dbAccount.connections.length >= 1) {
			let connections = "";

			let count = 0;
			for (const connection of dbAccount.connections) {
				count++;
				const { networkName, displayName, deeplink } = connection;

				connections += `**${count}\\. ${networkName}**\nName: ${displayName}\nLink: ${deeplink}\n\n`;
			}

			embed.fields.push({
				name: translateKey(dbUser.locale, "connections"),
				value: connections
			});
		}

		interaction.createFollowup({ embed: embed });
		dbAccount.save();
	}
};
