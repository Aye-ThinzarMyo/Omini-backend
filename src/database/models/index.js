import User from "./User";
import Log from "./Log";

User.hasMany(Log, { foreignKey: "userId", as: "logs" });
Log.belongsTo(User, { foreignKey: "userId", as: "user" });

export { User, Log };
