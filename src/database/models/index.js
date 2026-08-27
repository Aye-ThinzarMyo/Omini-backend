import User from "./User";
import Log from "./Log";
import AgentInbox from "./AgentInbox";
import Notification from "./Notification";

User.hasMany(Log, { foreignKey: "userId", as: "logs" });
Log.belongsTo(User, { foreignKey: "userId", as: "user" });

export { User, Log, AgentInbox, Notification };
