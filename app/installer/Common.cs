// Partes usadas pelo instalador (Setup.cs) e pelo abridor (Launcher.cs): atalhos, registro e processos.
// C# 5 (csc do .NET Framework que já vem no Windows) — sem $"", ?. nem nameof.
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using Microsoft.Win32;

static class Common
{
    public const string AppName = "ytbaixar";
    public const string UninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\ytbaixar";

    public static string DefaultInstallDir
    {
        get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", AppName); }
    }

    public static string StartMenuShortcut
    {
        get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), AppName + ".lnk"); }
    }

    public static string DesktopShortcut
    {
        get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), AppName + ".lnk"); }
    }

    // Atalho .lnk pelo WScript.Shell (COM), sem precisar de PowerShell
    public static void CreateShortcut(string lnkPath, string target, string workDir, string icon, string description)
    {
        Type t = Type.GetTypeFromProgID("WScript.Shell");
        object shell = Activator.CreateInstance(t);
        object lnk = t.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { lnkPath });
        Type lt = lnk.GetType();
        lt.InvokeMember("TargetPath", BindingFlags.SetProperty, null, lnk, new object[] { target });
        lt.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, lnk, new object[] { workDir });
        lt.InvokeMember("IconLocation", BindingFlags.SetProperty, null, lnk, new object[] { icon + ",0" });
        lt.InvokeMember("Description", BindingFlags.SetProperty, null, lnk, new object[] { description });
        lt.InvokeMember("Save", BindingFlags.InvokeMethod, null, lnk, null);
    }

    public static void DeleteQuietly(string file)
    {
        try { if (File.Exists(file)) File.Delete(file); } catch { }
    }

    // Fecha o ytbaixar que estiver rodando desta pasta (o node.exe que vem junto)
    public static void StopRunning(string installDir)
    {
        string node = Path.GetFullPath(Path.Combine(installDir, "runtime", "node.exe"));
        foreach (Process p in Process.GetProcessesByName("node"))
        {
            try
            {
                if (string.Equals(Path.GetFullPath(p.MainModule.FileName), node, StringComparison.OrdinalIgnoreCase))
                {
                    p.Kill();
                    p.WaitForExit(5000);
                }
            }
            catch { }
            finally { p.Dispose(); }
        }
    }

    // Entrada em "Configurações > Apps instalados", com o botão Desinstalar
    public static void RegisterUninstall(string installDir, string version, long sizeKb)
    {
        string exe = Path.Combine(installDir, "ytbaixar.exe");
        using (RegistryKey k = Registry.CurrentUser.CreateSubKey(UninstallKey))
        {
            k.SetValue("DisplayName", AppName);
            k.SetValue("DisplayVersion", version);
            k.SetValue("Publisher", "ytbaixar");
            k.SetValue("DisplayIcon", Path.Combine(installDir, "ytbaixar.ico"));
            k.SetValue("InstallLocation", installDir);
            k.SetValue("UninstallString", "\"" + exe + "\" /uninstall");
            k.SetValue("QuietUninstallString", "\"" + exe + "\" /uninstall /S");
            k.SetValue("URLInfoAbout", "https://github.com/agenor01/ytbaixar");
            k.SetValue("EstimatedSize", (int)Math.Min(sizeKb, int.MaxValue), RegistryValueKind.DWord);
            k.SetValue("NoModify", 1, RegistryValueKind.DWord);
            k.SetValue("NoRepair", 1, RegistryValueKind.DWord);
        }
    }

    public static long DirSizeKb(string dir)
    {
        long total = 0;
        try
        {
            foreach (string f in Directory.GetFiles(dir, "*", SearchOption.AllDirectories))
            {
                try { total += new FileInfo(f).Length; } catch { }
            }
        }
        catch { }
        return total / 1024;
    }
}
