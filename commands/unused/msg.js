"use strict";

const { userModel, guildModel } = require("../../database.js");

const messages = {
	verification: {
		title: "Verification",
		description: "Welcome to {guild_name}!\n\nBefore you can access the server, we need you to verify your account. This is to make sure you are not an alt, and incase the server gets terminated, We can reinvite everyone back into the new server.",
		components: [{
			type: 1,
			components: [
				{
					type: 2,
					label: "Verify",
					style: 3,
					custom_id: "a"
				}
			]
		}]
	},
	rules: {
		title: "Yern Rules",
		description: "When in the Yern Discord, You need to follow the rules.\n\n1. Have Common Sense\n2. Follow Discord TOS\n3. Read Yern's Privacy Policy\n\nIf you failed to read these rules, you'll be **banned**.",
		components: [{
			type: 1,
			components: [{
				type: 2,
				label: "Privacy Policy",
				style: 5,
				url: "https://crashary.uk/policy",
			}]
		}]
	},
	premium: {
		description: "__**Premium Perks**__\n\n:star: Unlimited uses for `/nuke` - does `/dj` and `/spamchat` at once :star:\n:star: Access to `/list` - shows every realm indexed by Yern :star:\n:star: `/getrandomcode` can generate up to 5 realm codes at once :star:\n:star: `/getrandomcode` can filter realms by text in their names :star:\n:star: Access to `/resolver` - database of IPs, emails and device IDs for Xbox Accounts :star:\n:star: Unlimited `/skinstealer` uses :star:\n:star: `dupe` option for `/dj`, `/spamchat` and `nuke` - makes 3 additional bots join :star:\n:star: `obtain_chat_logs` option for `/dj`, `/spamchat` and `/nuke` - gives you a log of every chat message sent during a test :star:\n:star: Reduced ratelimits for some commands :star:\n:star: `/dj`, `/spamchat` and `/nuke` can be used for up to 30 minutes :star:\nAccess to `/chatbot` - AI that joins realms and responds to any questions asked\n`/joinflood` - Makes bunch of random accounts repeatedly join and leave a realm\n\nWhat are you waiting for? Get Yern Premium at #shop!"
	}
};

const choices = [];
for (const m in messages) {
	choices.push({ name: m, value: m });
}

module.exports = {
	name: "msg",
	description: "Post a preset message.",
	options: [
		{
			type: 3,
			name: "message",
			description: "The message to post.",
			required: true,
			choices: choices
		}
	],
	dm_permission: false,
	staffOnly: true,
	execute: async (interaction, args) => {
		const message = messages[args.message];
		const guild = interaction.channel.guild;

		const embed = {
			title: message.title,
			description: message.description.replaceAll("{guild_name}", guild.name),
			timestamp: new Date(),
			color: 65280
		};

		interaction.createFollowup({
			embed: embed,
			components: message.components
		});
	},
	componentPressEvent: verifyUser
};

async function verifyUser(interaction) {
	const user = interaction.member;
	const dbUser = await userModel.findOne({ id: user.id });

	/**
	 * a = verify
	*/

	if (!dbUser?.verified) {
		interaction.createMessage({
			content: "To verify yourself, please visit https://verification.crashary.uk\\.",
			flags: 64
		});
		return;
	}

	if (dbUser.blacklisted) return interaction.createMessage({
		content: "You are blacklisted from the bot.",
		flags: 64,
	});

	const dbGuild = await guildModel.findOne({ id: interaction.channel.guild.id });

	if (!dbGuild.memberRole) {
		return interaction.createMessage({
			content: "This server does not have a verification role set. Please contact the server administrators.",
			flags: 64
		});
	}

	user.addRole(dbGuild.memberRole, "Verified with Yern.");

	interaction.createMessage({
		content: "You are now verified!",
		flags: 64
	});
}
