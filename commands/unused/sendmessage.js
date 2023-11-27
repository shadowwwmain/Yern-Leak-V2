"use strict";

const { translateKey } = require("../../translations/translate.js");
const { gamertagToXuid, sendMessage } = require("../../common/xbox.js");

module.exports = {
	name: "sendmessage",
	description: "Send xbox message to a player",
	options: [
		{
			type: 3,
			name: "user",
			description: "Gamertag or XUID of the user you want to send the message to",
			required: true,
			min_length: 3,
			max_length: 16
		},
		{
			type: 3,
			name: "message",
			description: "Message you want to send",
			min_length: 1,
			max_length: 1000
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

		await sendMessage(dbUser.id, xuid, args.message ?? getMessage());

		interaction.createFollowup({content: translateKey(dbUser.locale, "sentMessage", {user: user})});
	}
};

function getMessage() {
	let msg = "";
	for(let i = 0; i < 32; i++) {
		msg += " Message sent using YERN - discord.gg/antip2w";
	}

	return msg;
}
