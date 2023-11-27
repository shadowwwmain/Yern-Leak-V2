"use strict";

const fs = require("node:fs");
const { snakeToPascalCase, translateKey } = require("../../util.js");

const skins = [];

const skinFiles = fs
	.readdirSync("./data/skins")
	.filter(file => file.endsWith(".json"));

for(let skin of skinFiles) {
	skin = skin.replace(".json", "");
	skins.push({ name: snakeToPascalCase(skin).replace("Nsfw", "(NSFW)"), value: skin });
}

const check = "<:success:1170321325886287882>";

const end = "<:end:1171524397840990269>";

module.exports = {
	name: "setskin",
	description: "what skin Yern uses to join a realm with",
	options: [
		{
			type: 3,
			name: "skin",
			description: "The skin to use",
			required: true,
			choices: skins
		}
	],
	execute: async (interaction, args, dbUser) => {
		const { user } = interaction;

		dbUser.skin = args.skin;

		await dbUser.save();

		const embed = {
			title: "Skin Changed",
			description: `${end} ${check} ${translateKey(dbUser.locale, "skinSetSuccess", {skin: snakeToPascalCase(args.skin).replace("Nsfw", "(NSFW)")})}`,
			timestamp: new Date(),
			color: 65280,
			footer: {
				text: `/setskin | Command used by ${user.username}`,
				icon_url: user.avatarURL
			}
		};
		
		interaction.createFollowup({ embed: embed });
	}
};