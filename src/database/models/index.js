import User from "./User";
import Log from "./Log";
import AgentInbox from "./AgentInbox";

User.hasMany(Log, { foreignKey: "userId", as: "logs" });
Log.belongsTo(User, { foreignKey: "userId", as: "user" });

export { User, Log, AgentInbox };
