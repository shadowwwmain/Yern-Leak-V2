"use strict";

const { translateKey } = require("../../translations/translate.js");
const { gamertagToXuid, removeFriend } = require("../../common/xbox.js");

module.exports = {
	name: "removefriend",
	description: "Remove a player from your xbox friends list",
	options: [
		{
			type: 3,
			name: "user",
			description: "Gamertag or XUID of a user to unfriend",
			required: true,
			min_length: 3,
			max_length: 16
		}
	],
	requireLink: true,
	execute: async (interaction, args, dbUser) => {
		const { user } = args;

		let xuid = user;
		if(user.length !== 16 && !user.startsWith("2")) {
			xuid = await gamertagToXuid(dbUser.id, user);

			if(!xuid) return interaction.createFollowup(translateKey(dbUser.locale, "gamertagInvalid"));
		}

		await removeFriend(dbUser.id, xuid);

		interaction.createFollowup({content: translateKey(dbUser.locale, "removedFriend", {user: user})});
	}
};
