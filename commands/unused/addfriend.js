"use strict";

const { translateKey } = require("../../translations/translate.js");
const { gamertagToXuid, addFriend } = require("../../common/xbox.js");

module.exports = {
	name: "addfriend",
	description: "Add a player to your xbox friends list",
	options: [
		{
			type: 3,
			name: "user",
			description: "Gamertag or XUID of a user to friend",
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

		await addFriend(dbUser.id, xuid);

		interaction.createFollowup({content: translateKey(dbUser.locale, "addedFriend", {user: user})});
	}
};
