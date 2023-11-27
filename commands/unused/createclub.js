"use strict";

const { translateKey } = require("../../translations/translate.js");
const { createClub } = require("../../common/xbox.js");

module.exports = {
	name: "createclub",
	description: "Create a Xbox Club",
	options: [
		{
			type: 3,
			name: "name",
			description: "The name of the club",
			required: true,
			min_length: 1,
			// A name of a club can only be 64 characters long
			max_length: 64
		},
		{
			type: 3,
			name: "type",
			description: "The club type",
			choices: [
				{
					name: "Public (Anyone Can Join)",
					value: "Open"
				},
				{
					name: "Closed (Invite-only)",
					value: "Closed"
				},
				{
					name: "Private",
					value: "Secret"
				}
			]
		}
	],
	requireLink: true,
	execute: async (interaction, args, dbUser) => {
		const { name, type } = args;

		const clubData = await createClub(dbUser.id, name, type);
		if (clubData.errorMsg) return interaction.createFollowup({ content: translateKey(dbUser.locale, "unableToCreateClub", { error: clubData.errorMsg }) });

		const { id, created } = clubData;

		const embed = {
			title: translateKey(dbUser.locale, "createXboxClub"),
			timestamp: new Date(),
			color: 65280,
			description: translateKey(dbUser.locale, "createdXboxClub", {
				name: name,
				id: id,
				type: type ?? "Open",
				created: `<t:${Math.floor(new Date(created).getTime() / 1000)}:R> (${created})`
			})
		};

		interaction.createFollowup({ embed: embed });
	}
};
