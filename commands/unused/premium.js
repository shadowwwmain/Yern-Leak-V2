"use strict";

const { userModel, createUserDefaults } = require("../../database.js");
const ms = require("ms");

module.exports = {
	name: "premium",
	description: "information and management of Yern Premium.",
	options: [
		{
			type: 1,
			name: "info",
			description: "Get info regarding Yern Premium."
		},
		{
			type: 1,
			name: "add",
			description: "Give people Yern Premium",
			options: [
				{
					type: 6,
					name: "user",
					description: "The user to give premium",
					required: true
				},
				{
					type: 3,
					name: "duration",
					description: "How long the user should have premium for ex. '1d', '14d', '30d'",
					required: true,
					min_length: 2,
					max_length: 10
				}
			]
		},
		{
			type: 1,
			name: "remove",
			description: "Remove people's Yern Premium",
			options: [
				{
					type: 6,
					name: "user",
					description: "The user to remove premium from",
					required: true
				},
				{
					type: 3,
					name: "duration",
					description: "How much time to remove from the subscription for ex. '1d', '14d', '30d'",
					required: false,
					min_length: 2,
					max_length: 10
				}
			]
		},
		{
			type: 1,
			name: "query",
			description: "Get the status on user premium",
			options: [
				{
					type: 6,
					name: "user",
					description: "The user to query",
					required: true
				}
			]
		}
	],
	execute: async (interaction, args, dbUser) => {
		const { user } = interaction;
		const { sub_command } = args;

		const userId = args.user ?? user.id;

		const targetDbUser = await userModel.findOne({ id: userId }) ?? createUserDefaults({ id: userId });

		const { premium, premiumExpiresIn } = targetDbUser;

		if (sub_command === "info") {
			const message = premium ? `You currently have Yern Premium! It expires in <t:${Math.floor(premiumExpiresIn / 1000)}:R> (${new Date(premiumExpiresIn).toISOString()})` : "You currently do not have Yern premium.";

			const embed = {
				title: "Yern Premium",
				description: `${message}\n\n`,
				timestamp: new Date(),
				color: premium ? 65280 : 16729871
			};

			return interaction.createFollowup({
				embed: embed,
			});
		}

		if (!dbUser.staff) return interaction.createFollowup({ content: "These sub-commands are locked for staff only." });

		if (sub_command === "add") {
			const { duration } = args;

			const time = ms(duration);
			if (!time) return interaction.createFollowup({ content: "The time format is invalid." });

			if (!targetDbUser.premiumExpiresIn) targetDbUser.premiumExpiresIn = 0;

			targetDbUser.premium = true;
			targetDbUser.premiumExpiresIn += targetDbUser.premiumExpiresIn < 100 ? Date.now() + time : time;
			await targetDbUser.save();

			interaction.createFollowup({ content: `Successfully added ${ms(time, { long: true })} to <@${userId}> (${userId})'s Premium subscription.` });
		} else if (sub_command === "remove") {
			const { duration } = args;

			let time;
			if (duration) {
				time = ms(duration);
			} else time = targetDbUser.premiumExpiresIn;

			if (!time) return interaction.createFollowup({ content: "The time format is invalid." });

			targetDbUser.premiumExpiresIn -= time;
			await targetDbUser.save();

			interaction.createFollowup({ content: `Successfully removed ${ms(Date.now() - time, { long: true })} from the users subscription.` });
		} else if (sub_command === "query") {
			interaction.createFollowup({ content: `This user ${premium ? `**has premium until ${new Date(premiumExpiresIn)}** (expires <t:${Math.floor(premiumExpiresIn / 1000)}:R>)` : "**doesn't have premium**"}.` });
		}
	}
};
