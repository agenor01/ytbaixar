// ytbaixar.exe — abre o app (servidor escondido + janela própria) e também desinstala (/uninstall).
using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;
using Microsoft.Win32;

static class Launcher
{
    [STAThread]
    static int Main(string[] args)
    {
        string dir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
        bool uninstall = false, silent = false;
        foreach (string a in args)
        {
            string s = a.ToLowerInvariant();
            if (s == "/uninstall") uninstall = true;
            else if (s == "/s") silent = true;
        }
        if (uninstall) return Uninstall(dir, silent);

        string node = Path.Combine(dir, "runtime", "node.exe");
        if (!File.Exists(node)) node = "node"; // versão de desenvolvimento: usa o Node do PC
        var psi = new ProcessStartInfo(node, "\"" + Path.Combine(dir, "server.js") + "\" --app");
        psi.WorkingDirectory = dir;
        psi.UseShellExecute = false;
        psi.CreateNoWindow = true;
        try
        {
            Process.Start(psi);
            return 0;
        }
        catch (Exception e)
        {
            MessageBox.Show("Não consegui abrir o ytbaixar:\n\n" + e.Message, "ytbaixar", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }

    static int Uninstall(string dir, bool silent)
    {
        if (!silent)
        {
            DialogResult r = MessageBox.Show(
                "Remover o ytbaixar deste computador?\n\nOs vídeos que você já baixou continuam na sua pasta Downloads.",
                "Desinstalar ytbaixar", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
            if (r != DialogResult.Yes) return 1;
        }

        Common.StopRunning(dir);
        Common.DeleteQuietly(Common.StartMenuShortcut);
        Common.DeleteQuietly(Common.DesktopShortcut);
        try { Registry.CurrentUser.DeleteSubKeyTree(Common.UninstallKey, false); } catch { }

        // Este .exe está dentro da pasta: apaga tudo logo depois que ele fechar
        var psi = new ProcessStartInfo("cmd.exe", "/c ping -n 3 127.0.0.1 >nul & rmdir /s /q \"" + dir + "\"");
        psi.CreateNoWindow = true;
        psi.UseShellExecute = false;
        psi.WorkingDirectory = Path.GetTempPath();
        Process.Start(psi);

        if (!silent) MessageBox.Show("O ytbaixar foi removido.", "ytbaixar", MessageBoxButtons.OK, MessageBoxIcon.Information);
        return 0;
    }
}
