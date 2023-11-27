"use strict";

const { translateKey } = require("../../translations/translate.js");
const { getRealmData } = require("../../common/realms.js");
const { realmModel } = require("../../database.js");

module.exports = {
	name: "getrandomcode",
	description: "gets a random realm code from the database",
	options: [
		{
			type: 4,
			name: "realm_codes",
			description: "how many realm codes to grab",
			min_value: 1,
			max_value: 5
		},
		{
			type: 3,
			name: "match",
			description: "text used to match in realm code name",
			min_length: 1,
			max_length: 15
		},
		{
			type: 5,
			name: "turbo",
			description: "skip fetching certain data features to make the command run way faster"
		}
	],
	execute: async (interaction, args, dbUser) => {
		const { user } = interaction;
		let { match } = args;
		let codes = args.realm_codes ?? 1;

		let alerts = "";

		const searchQuery = { whitelisted: false, realmCode: { $ne: undefined } };
		if (match) searchQuery.name = { $regex: new RegExp(match.replace(/[^a-zA-Z0-9 ]/g, ""), "i") };

		const documents = await realmModel.countDocuments(searchQuery);
		const realms = (await realmModel.findOne(searchQuery).skip(Math.floor(Math.random() * (documents + 1))).limit(codes)) ?? [];

		const embeds = [];
		for (let i = 0; i < codes; i++) {
			const randomRealm = realms[i] ?? await realmModel.findOne(searchQuery).skip(Math.floor(Math.random() * (documents + 1)));
			if (!randomRealm) break;

			if (!randomRealm.realmCode) {
				i--;
				continue;
			}

			const realmData = await getRealmData(randomRealm.realmCode, dbUser.didLink ? dbUser.id : undefined, !args.turbo);

			if (realmData.errorMsg) {
				if (realmData.errorMsg === "Invalid link") {
					randomRealm.realmCode = null;
					randomRealm.save();

					i--;
					continue;
				} else if (realmData.errorMsg === "User banned") {
					return interaction.createFollowup(translateKey(dbUser.locale, "accountBanned"));
				}

				return interaction.createFollowup(translateKey(dbUser.locale, "unableToGetRealmData", { error: realmData.errorMsg }));
			}

			delete realmData.honeypot;
			realmData.yern_id = randomRealm.cid ?? "";
			realmData.totalBans = randomRealm.totalBans;
			realmData.whitelisted = randomRealm.whitelisted;

			embeds.push({
				description: `\`\`\`json\n${JSON.stringify(realmData, null, 2)}\`\`\``,
				color: 65280,
				footer: {
					text: `/getcode | Command used by ${user.username}`,
					icon_url: user.avatarURL
				}
			});
		}

		if (embeds.length === 0) return interaction.createFollowup({ content: translateKey(dbUser.locale, "noRealmsFound") });

		embeds[0] = {
			...embeds[0],

			title: translateKey(dbUser.locale, "randomRealmCode")
		};

		embeds[embeds.length - 1].footer = {
			text: translateKey(dbUser.locale, "realmFromPool", { documents })
		};

		interaction.createFollowup({
			content: alerts,
			embeds: embeds
		});
	}
};
