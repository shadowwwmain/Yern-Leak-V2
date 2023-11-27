"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { userModel, realmModel, accountsModel, createUserDefaults, createRealmDefaults, createAccountDefaults } = require("../../database.js");

const collections = {
	users: userModel,
	realms: realmModel,
	accounts: accountsModel
};

module.exports = {
	name: "backup",
	description: "make a backup of the database.",
	staffOnly: true,
	options: [
		{
			type: 1,
			name: "create",
			description: "make a backup of the databse",
			options: [
				{
					type: 5,
					name: "users",
					description: "Should the users collection be backed up?"
				},
				{
					type: 5,
					name: "realms",
					description: "Should the realms collection be backed up?"
				},
				{
					type: 5,
					name: "accounts",
					description: "Should the accounts collection be backed up?"
				},
				{
					type: 5,
					name: "prettify",
					description: "Should backup contents be prettified for easier editing?"
				}
			]
		},
		{
			type: 1,
			name: "load",
			description: "Load a backup of the database",
			options: [
				{
					type: 4,
					name: "backup_id",
					description: "The ID of the backup to load",
					required: true,
					min_value: 0,
					max_value: 2000000000000
				},
				{
					type: 5,
					name: "users",
					description: "Whether or not to restore the users collection to the backup?"
				},
				{
					type: 5,
					name: "realms",
					description: "Whether or not to restore the realms collection to the backup?"
				},
				{
					type: 5,
					name: "accounts",
					description: "Whether or not to restore the realms collection to the backup?"
				}
			]
		}
	],
	execute: async (interaction, args) => {
		const { sub_command } = args;

		// make sure backups folder exists
		if(!fs.existsSync("backups")) {
			fs.mkdirSync("backups");
		}

		for(const name in collections) {
			if(typeof args[name] === "undefined") args[name] = true;
		}

		if(sub_command === "create") {
			const now = Date.now();
			const dirname = path.join(__dirname, "../../backup");

			let message = "Database has been backed up.\n\nFiles:\n";

			for(const name in collections) {
				if(args[name] === false) continue;

				const collection = JSON.stringify(await collections[name].find(), null, args.prettify ? 2 : undefined);

				fs.writeFileSync(`backups/${now}_${name}.json`, collection);
				message += `${name}: ${dirname}\\${now}_${name}.json\n`;
			}

			interaction.createFollowup({
				content: message
			});
		} else if(sub_command === "load") {
			const { backup_id } = args;

			let log = "";

			const msg = await interaction.createFollowup({content:"Loading the backup of the database, please wait."});

			for(const name in collections) {
				if(args[name] === false) continue;
				const collection = collections[name];

				await collection.deleteMany();

				let backupData;
				try {
					backupData = JSON.parse(fs.readFileSync(`backups/${backup_id}_${name}.json`, {encoding: "utf8"}));
				} catch (error) {
					log += `:warning: Unable to load ${name} backup: ${error}\n`;
				}

				if(backupData) {
					for(const data of backupData) {
						if(!data.id && !data.xuid) continue;
						let mongoDbData = await collection.findOne(name === "accounts" ? {xuid:data.xuid} : {id:data.id});

						if(mongoDbData) {
							for(const item of Object.keys(data)) {
								if(item === "__v") continue;
								mongoDbData[item] = data[item];
							}
						} else {
							switch(name) {
								case "users":
									mongoDbData = createUserDefaults(data);
									break;
								case "realms":
									mongoDbData = createRealmDefaults(data);
									break;
								case "accounts":
									mongoDbData = createAccountDefaults(data);
							}
						}

						await mongoDbData.save();
					}

					log += `:white_check_mark: Successfully loaded ${name} collection\n`;
				}
			}

			msg.edit({content:`Backup was finished loading.\n\nLog:\n${log}`});
		}
	}
};