"use strict";

const { translateKey } = require("../../translations/translate.js");
const { gamertagToXuid, getTitleHistory } = require("../../common/xbox.js");

module.exports = {
	name: "lastplayed",
	description: "the last played games of a user",
	options: [
		{
			type: 3,
			name: "user",
			description: "gamertag of a user to get title history from",
			required: true,
			min_length: 3,
			max_length: 16
		}
	],
	execute: async (interaction, args, dbUser) => {
		const { user } = interaction;
		const { accountID } = interaction;
		const requestedUser = args.user;

		const invalidGamertag = translateKey(dbUser.locale, "gamertagInvalid");

		if (requestedUser.match(/[^A-Za-z0-9- ]/)) return interaction.createFollowup(invalidGamertag);

		let xuid = requestedUser;
		if (requestedUser.length !== 16 && !requestedUser.startsWith("2")) {
			xuid = await gamertagToXuid(accountID, requestedUser);

			if (!xuid) return interaction.createFollowup(invalidGamertag);
		}

		const history = await getTitleHistory(accountID, xuid);
		if (!history) return interaction.createFollowup(invalidGamertag);

		if (history.length === 0) return interaction.createFollowup(translateKey(dbUser.locale, "titleHistoryPrivate"));

		let games = ``;

		for (let i = 0; i < 5; i++) {
			const title = history[i];
			if (!title) break;

			const { titleId, name, serviceConfigId: scid, type, titleHistory } = title;
			const { lastTimePlayed: lastPlayed } = titleHistory;

			games += `**${i + 1}\\. ${name}**\nTitle ID: ${titleId}\nSCID: ${scid}\nType: ${type}\nLast Played: <t:${Math.floor(new Date(lastPlayed).getTime() / 1000)}:R> (${lastPlayed})\n\n`;
		}

		const embed = {
			title: translateKey(dbUser.locale, "lastPlayedGames"),
			description: games,
			timestamp: new Date(),
			color: 65280,
			footer: {
				text: `/lastplayed | Command used by ${user.username} | XUID: ${xuid}`,
				icon_url: user.avatarURL
			}
		};

		interaction.createFollowup({ embed: embed });
	}
};
