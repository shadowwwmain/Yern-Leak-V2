"use strict";

const { generateRandomString, translateKey } = require("../../util.js");

module.exports = {
	name: "passwordgen",
	description: "Generate random secure passwords",
	options: [
		{
			type: 4,
			name: "count",
			description: "How much passwords to generate",
			min_value: 1,
			max_value: 16
		},
		{
			type: 4,
			name: "length",
			description: "How long should the password be",
			min_value: 1,
			max_value: 64
		},
		{
			type: 5,
			name: "letters",
			description: "Should the password have lowercase letters in it"
		},
		{
			type: 5,
			name: "uppercase_letters",
			description: "Should the password have uppercase letters in it"
		},
		{
			type: 5,
			name: "numbers",
			description: "Should the password have numbers in it"
		},
		{
			type: 5,
			name: "symbols",
			description: "Should the password have symbols in it"
		},
	],
	execute: async (interaction, args, dbUser) => {
		const { letters, uppercase_letters, numbers, symbols } = args;

		const count = args.count ?? 6;
		const length = args.length ?? 16;

		let charset = "";

		if (letters || typeof letters === "undefined") charset += "abcdefghijklmnopqrstuvwxyz";
		if (uppercase_letters || typeof uppercase_letters === "undefined") charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
		if (numbers || typeof numbers === "undefined") charset += "12345678901";
		if (symbols) charset += "!@#$%^&*()_+-=[]{};:'";

		const passwords = [];

		for (let i = 0; i < count; i++) {
			passwords.push(generateRandomString(length, charset.length === 0 ? undefined : charset));
		}

		const embed = {
			title: "Random Password",
			timestamp: new Date(),
			color: 65280,
			description: `${translateKey(dbUser.locale, "generatedPasswords", { count })}.\n\n${passwords.join("\n")}`
		};

		interaction.createFollowup({ embed: embed });
	}
};
