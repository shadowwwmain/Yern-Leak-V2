"use strict";

const { translateKey } = require("../../translations/translate.js");
const { generateGamertags } = require("../../common/xbox.js");

module.exports = {
	name: "gamertags",
	description: "Generate random gamertags",
	options: [
		{
			type: 4,
			name: "count",
			description: "How much gamertags to generate",
			min_value: 1,
			max_value: 10
		},
		{
			type: 3,
			name: "seed",
			description: "Seed to use for generating the gamertags",
			min_length: 1,
			max_length: 12
		}
	],
	execute: async (interaction, args, dbUser) => {
		const { count, seed } = args;

		const gamertags = await generateGamertags(dbUser.didLink ? dbUser.id : undefined, count, seed);
		if (gamertags.errorMsg) return interaction.createFollowup({ content: translateKey(dbUser.locale, "unableToGenerateGamertags", { error: gamertags.errorMsg }) });

		let message = translateKey(dbUser.locale, "generatedGamertags", { count });

		for (const gamertag of gamertags) {
			message += `**${gamertag}**\n`;
		}

		const embed = {
			title: translateKey(dbUser.locale, "generateGamertags"),
			timestamp: new Date(),
			color: 65280,
			description: message
		};

		interaction.createFollowup({ embed: embed });
	}
};
