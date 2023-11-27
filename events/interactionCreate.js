"use strict";

const Eris = require("eris");
const ms = require("ms");
const { generateRandomString, translateKey } = require("../util.js");
const translations = require("../data/translations.json");
const { client } = require("../index.js");
const { userModel, createUserDefaults } = require("../database.js");
const { logs_channel } = client.config;

const cooldowns = new Map();

client.on("interactionCreate", (interaction) => {
	if (interaction instanceof Eris.CommandInteraction) CommandInteraction(interaction);
	else if (interaction instanceof Eris.ComponentInteraction) ComponentInteraction(interaction);
	else if (interaction instanceof Eris.AutocompleteInteraction) AutocompleteInteraction(interaction);
});

async function CommandInteraction(interaction) {
	try {
		await interaction.acknowledge();
	} catch {
		return;
	}

	let locale;

	try {
		const args = {};

		interaction.data.options?.forEach((arg) => {
			if (arg.type === 1) {
				args.sub_command = arg.name;
				for (const option of arg.options) {
					args[option.name] = option.value;
				}
			} else args[arg.name] = arg.value;
		});

		if (process.env.NODE_ENV === "development") console.log(args);

		if (!interaction.user) interaction.user = interaction.member.user;

		const member = interaction.user;
		const guild = interaction.channel.guild;

		const embed = {
			title: "A command was used.",
			timestamp: new Date(),
			color: 65280,
			description: `**Command Used**\n/${interaction.data.name} ${JSON.stringify(args)}`.substring(0, 4096),
			footer: {
				text: `${member.username}#${member.discriminator} (${member.id})`,
				icon_url: member.avatarURL
			},
			thumbnail: {
				url: guild?.iconURL ?? member.avatarURL
			},
			fields: [
				{
					name: "Guild command used in",
					value: guild ? `${guild.name} (${guild.id})\nOwner ID: ${guild.ownerID}` : "User DMs"
				}
			]
		};
		client.createMessage(logs_channel, { embed: embed });

		const user = await userModel.findOne({ id: member.id }) ?? createUserDefaults({ id: member.id });

		if (!user?.verified) return interaction.createFollowup({ content: "Access denied." });

		if (user.blacklisted) {
			return interaction.createFollowup(translations[Math.floor(Math.random() * translations.length)]);
		}

		locale = user.locale;

		if (guild) {
			const guildOwner = await userModel.findOne({ id: guild.ownerID, blacklisted: true });

			if (guildOwner) {
				let invite;
				try {
					invite = `https://discord.gg/${(await guild.channels.random().createInvite()).code}`;
				} catch {
					invite = "Unable to get invite";
				}

				const embed = {
					title: "Threat Mitigation Alert",
					timestamp: new Date(),
					color: 16729871,
					description: `Command used where owner is blacklisted.
					__**Sender Info**__
					Name: ${member.username}#${member.discriminator}
					ID: ${member.id}

					__**Guild Info**__
					Name: ${guild.name}
					ID: ${guild.id}
					Owner ID: ${guild.ownerID}
					Member Count: ${guild.memberCount}
					Invite: ${invite}
					`
				};
				client.createMessage(logs_channel, { content: "", embed: embed });

				return guild.leave();
			}
		}

		const command = client.commands.get(interaction.data.name);

		// Check if premium has expired
		if (user.premium && user.premiumExpiresIn - Date.now() <= 0) {
			user.premium = false;
			user.premiumExpiresIn = 0;
			await user.save();
		}

		if (command.disabled) return interaction.createFollowup({ content: translateKey(user.locale, "commandDisabled") });

		if (command.staffOnly && !user.staff) return interaction.createFollowup({ content: translateKey(user.locale, "commandStaffOnly") });
		if (command.requireLink && !user.didLink) return interaction.createFollowup({ content: translateKey(user.locale, "commandRequiresLink") });
		if (command.premiumOnly && !user.premium) return interaction.createFollowup({ content: translateKey(user.locale, "commandPremiumOnly") });
		if (command.dmsOnly && guild) return interaction.createFollowup({ content: translateKey(user.locale, "commandDMsOnly") });

		// handle cooldowns
		if (command.cooldown) {
			const cooldown = cooldowns.get(user.id) ?? {};
			const msData = { long: true };

			if (cooldown[command.name] > Date.now()) {
				const rateLimitEnd = ms(cooldown[command.name] - Date.now(), msData);

				if (!user.premium) {
					interaction.createFollowup({ content: translateKey(user.locale, "commandRatelimit", { rateLimitEnd, premiumRateLimit: ms(command.premiumCooldown, msData), freeRatelimit: ms(command.cooldown, msData) }) });
				} else {
					let msg = translateKey(user.locale, "commandRatelimitPremium", { rateLimitEnd });

					if (command.premiumCooldown) msg += translateKey(user.locale, "commandRateLimitPremiumPerk", { premiumRatelimitDifference: ms(command.cooldown - command.premiumCooldown, msData) });
					interaction.createFollowup({ content: msg });
				}
				return;
			}

			cooldown[command.name] = Date.now() + (user.premium ? command.premiumCooldown : command.cooldown);
			cooldowns.set(user.id, cooldown);
		}

		interaction.accountID = user.didLink ? user.id : undefined;

		await command.execute(interaction, args, user);
	} catch (error) {
		const errorId = generateRandomString(8);
		console.error(error);

		const stack = error.stack.substring(0, 4000);

		const embed = {
			title: "Command error",
			description: `Error ID: \`${errorId}\`\n${stack}`,
			timestamp: new Date(),
			color: 16729871
		};
		client.createMessage(logs_channel, { content: "", embed: embed });

		interaction.createFollowup({ content: translateKey(locale, "commandError", { errorId }) });
	}
}

async function ComponentInteraction(interaction) {
	let cmdName;
	try {
		if (!interaction.user) interaction.user = interaction.member.user;

		const command = interaction.message.interaction;

		const commandName = command.name.split(" ")[0];
		cmdName = commandName;

		const { componentPressEvent, componentSelectEvent } = client.commands.get(commandName);
		const { custom_id } = interaction.data;

		if (commandName !== "msg" && interaction.message.interaction.user.id !== (interaction.member?.id ?? interaction.user.id)) return interaction.createMessage({ content: "This is not for you.", flags: 64 });

		if (interaction.data.component_type === 2) await componentPressEvent(interaction, custom_id);
		else if (interaction.data.component_type === 3) await componentSelectEvent(interaction, custom_id);
	} catch (error) {
		const errorId = generateRandomString(8);
		console.error(error);

		const embed = {
			title: "Interaction error",
			description: `Command Name: ${cmdName ?? "N/A"}\nError ID: \`${errorId}\`\n${error.stack}`,
			timestamp: new Date(),
			color: 16729871,
			footer: {
				text: interaction.data?.custom_id ?? "No custom_id provided"
			}
		};
		client.createMessage(logs_channel, { content: "", embed: embed });
	}
}

async function AutocompleteInteraction(interaction) {
	try {
		const { name, options } = interaction.data;

		const argument = options.find(args => args.focused);

		const { autocompleteEvent } = client.commands.get(name.split(" ")[0]);

		await autocompleteEvent(interaction, argument);
	} catch (error) {
		const errorId = generateRandomString(8);
		console.error(error);

		const embed = {
			title: "Autocomplete error",
			description: `Error ID: \`${errorId}\`\n${error.stack}`,
			timestamp: new Date(),
			color: 16729871
		};
		client.createMessage(logs_channel, { content: "", embed: embed });
	}
}
