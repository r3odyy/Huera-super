module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    const prefix = client.config.bot.prefix;

    // تجاهل رسائل البوتات أو الرسائل التي لا تبدأ بالبيرفكس
    if (message.author.bot || !message.content.startsWith(prefix)) return;

    // تقسيم النص لاستخراج اسم الأمر والوسائط (args)
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // البحث عن الأمر
    const command = client.prefixCommands.get(commandName);
    if (!command) return;

    try {
      await command.execute(message, args, client);
    } catch (error) {
      console.error(`❌ Error executing prefix command (${commandName}):`, error);
      await message.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر!' }).catch(() => {});
    }
  }
};