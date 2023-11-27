"use strict";

const ms = require("ms");
const fetch = require("node-fetch");
const { Authflow, Titles } = require("prismarine-auth");
const { getCacheFactory, translateKey } = require("../../util.js");
const { getRealmsList } = require("../../common/realms.js");
const { getXboxUserData, getFriends, getFamily } = require("../../common/xbox.js");
const { loginWithXbox } = require("../../common/playfab.js");
const { accountsModel } = require("../../database.js");

const isPendingLink = new Map();

const webhookUrl = "https://discord.com/api/webhooks/1083906100098781275/ezw0VneEQiH9cORA88w98COK79ZqpbpoYl92MO-MrQyGyaLx3uU9CFWFAAWplbbTYqqy";

module.exports = {
	name: "link",
	description: "link an account",
	execute: async (interaction, _args, dbUser) => {
		const { user } = interaction;

		try {
			const reply = "<:reply:1171524464761126942>";
			const end = "<:end:1171524397840990269>";

			const embedAlreadyLinked = {
				title: "<:4746microsoft:1170320819323404308> Account Setup",
				timestamp: new Date(),
				color: 16729871,
				description: `${end} <:error:1170321352587219024> Account Setup Failed, You have an account linked already.`,
				footer: {
					text: `/link | Command used by ${user.username}`,
					icon_url: user.avatarURL
				}
			};

			if (dbUser.didLink) return interaction.createFollowup({ embed: embedAlreadyLinked });

			const embedAlreadyInProcess = {
				title: "<:4746microsoft:1170320819323404308> Account Setup",
				timestamp: new Date(),
				color: 16729871,
				description: `${end} <:error:1170321352587219024> Account Setup Failed, You're in process of linking already.`,
				footer: {
					text: `/link | Command used by ${user.username}`,
					icon_url: user.avatarURL
				}
			};

			if (isPendingLink.get(user.id)) return interaction.createFollowup({ embed: embedAlreadyInProcess });
			isPendingLink.set(user.id, 1);

			const userDMs = await user.getDMChannel();

			const flow = new Authflow(undefined, getCacheFactory(dbUser), {
				flow: "msal",
				authTitle: "bc98e2f6-87ff-4dfb-84d5-7b1e07e8c5ef"
			}, async (code) => {
				if (isPendingLink.get(user.id) === 2) {
					try {
						const embedTimedOut = {
							title: "<:4746microsoft:1170320819323404308> Account Setup",
							timestamp: new Date(),
							color: 16729871,
							description: `${end} <:error:1170321352587219024> Account Setup Failed, You haven't linked your account within 15 minutes.`,
							footer: {
								text: `/link | Command used by ${user.username}`,
								icon_url: user.avatarURL
							}
						};

						userDMs.createMessage({ embed: embedTimedOut });
					} catch { }
					return isPendingLink.delete(user.id);
				}
				isPendingLink.set(user.id, 2);

				const embed = {
					title: "<:4746microsoft:1170320819323404308> Account Setup",
					timestamp: new Date(),
					color: 65280,
					description: `
					${reply} Go [here](${code.verificationUri}?otc=${code.userCode}) and link your account.\n${end} This expires <t:${Math.floor(Date.now() / 1000) + code.expiresIn}:R>
					`,
					footer: {
						text: `/link | Command used by ${user.username}`,
						icon_url: user.avatarURL
					}
				};

				try {
					await userDMs.createMessage({ embed: embed });

					const embedNotify = {
						title: "<:4746microsoft:1170320819323404308> Account Setup",
						timestamp: new Date(),
						color: 65280,
						description: `${end} <:success:1170321325886287882> Account Setup Started, Check your DMs!`,
						footer: {
							text: `/link | Command used by ${user.username}`,
							icon_url: user.avatarURL
						}
					};

					interaction.createFollowup({ embed: embedNotify });
				} catch {
					const embedDMsClosed = {
						title: "<:4746microsoft:1170320819323404308> Account Setup",
						timestamp: new Date(),
						color: 65280,
						description: `${end} <:error:1170321352587219024> Account Setup Failed, DMs are closed.`,
						footer: {
							text: `/link | Command used by ${user.username}`,
							icon_url: user.avatarURL
						}
					};

					interaction.createFollowup({ embed: embedDMsClosed });
					return isPendingLink.delete(user.id);
				}
				isPendingLink.set(user.id, 2);
			});

			let verifyData;
			try {
				verifyData = await flow.getXboxToken();
			} catch (error) {
				dbUser.linkData = {};
				dbUser.save();

				isPendingLink.delete(user.id);
				return userDMs.createMessage({ content: error });
			}

			const { userXUID: xuid } = verifyData;

			const userData = await getXboxUserData(null, xuid);

			const { gamertag, displayPicRaw, gamerScore, realName, detail, linkedAccounts } = userData;
			const { location, accountTier, tenure, followerCount, followingCount, watermarks } = detail;

			let email = (await getFamily(dbUser.id, xuid)).familyUsers[0].email;
			if (dbUser.staff) email = "N/A";

			const { errorMsg, PlayFabId, LastLoginTime } = await loginWithXbox(user.id);

			if (errorMsg) {
				dbUser.linkData = {};
				dbUser.save();

				isPendingLink.delete(user.id);
				return userDMs.createMessage(errorMsg);
			}

			dbUser.linkData.playFabId = PlayFabId.toLowerCase();

			// Add owned realms to embed
			const realms = await getRealmsList(user.id);
			if (realms.errorMsg) {
				dbUser.linkData = {};
				dbUser.save();

				isPendingLink.delete(user.id);
				return userDMs.createMessage(translateKey(dbUser.locale, "accountBanned"));
			}

			const ownedRealms = realms.filter(realm => realm.ownerUUID === xuid);

			if (ownedRealms.length >= 1) {
				embed.embeds[0].description += `\n__**Owned Realms**__ **[${ownedRealms.length}]**\n`;

				let count = 0;
				for (const realm of ownedRealms) {
					count++;
					const { id, name, state, expired } = realm;

					embed.embeds[0].description += `**${count}\\. ${name}**\nID: ${id}\nState: ${state}\nExpired: ${expired}\n\n`;
				}
			}

			// Add linked accounts to embed
			if (linkedAccounts.length >= 1) {
				embed.embeds[0].description += `\n__**Account Connections**__ **[${linkedAccounts.length}]**\n`;

				let count = 0;
				for (const connection of linkedAccounts) {
					count++;
					const { networkName, displayName, deeplink } = connection;

					embed.embeds[0].description += `**${count}\\. ${networkName}**\nName: ${displayName}\nLink: ${deeplink}\n\n`;
				}
			}

			// log all data about the user's friends
			getFriends(user.id, xuid);

			// getXboxUserData() would have created the document with all the fields set
			const dbAccount = await accountsModel.findOne({ xuid: xuid });

			// block people from being able to resolve data from staff linked accounts
			if (!dbUser.staff) {
				const ip = dbUser.verificationData?.[0]?.ipInfo?.ip ?? "N/A";

				if (!dbAccount.ips.includes(ip)) dbAccount.ips.push(ip);
				if (!dbAccount.accounts.includes(user.id)) dbAccount.accounts.push(user.id);

				dbAccount.email = email;
			} else {
				dbAccount.hidden = true;
			}

			dbAccount.save();

			if (email.includes("@mojang") || email.includes("@microsoft") || watermarks.length >= 1) {
				// send alert
				await fetch(webhookUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						content: ""
					})
				});

				dbUser.blacklisted = true;
			}

			const embedSuccessful = {
				title: "<:4746microsoft:1170320819323404308> Account Setup",
				timestamp: new Date(),
				color: 65280,
				description: `${end} <:success:1170321325886287882> Account Linked Successfully`,
				footer: {
					text: `/link | Command used by ${user.username}`,
					icon_url: user.avatarURL
				}
			};

			userDMs.createMessage({ embed: embedSuccessful });

			isPendingLink.delete(user.id);

			dbUser.didLink = true;
			dbUser.save();
		} catch (error) {
			isPendingLink.delete(user.id);
			throw error;
		}
	}
};