// ytbaixar-Setup.exe — instalador com tela própria. Os arquivos do app vão dentro dele (recurso payload.zip).
//
//   ytbaixar-Setup.exe                    → assistente normal
//   ytbaixar-Setup.exe /S                 → instala sem perguntar nada
//   /D=C:\pasta   /NOSHORTCUTS   /NOREGISTRY   /OPEN   (opções extras, usadas nos testes)
using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

static class Setup
{
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();

    [STAThread]
    static int Main(string[] args)
    {
        var opt = new Options();
        string snapshot = null;
        foreach (string a in args)
        {
            string s = a.ToUpperInvariant();
            if (s == "/S") opt.Silent = true;
            else if (s.StartsWith("/D=")) opt.Dir = a.Substring(3).Trim('"');
            else if (s == "/NOSHORTCUTS") { opt.StartMenu = false; opt.Desktop = false; }
            else if (s == "/NOREGISTRY") opt.Registry = false;
            else if (s == "/OPEN") opt.OpenAfter = true;
            else if (s.StartsWith("/SNAPSHOT=")) snapshot = a.Substring(10).Trim('"');
        }

        // Desenha a tela num .png sem abrir janela (usado pra conferir o visual no build)
        if (snapshot != null)
        {
            try { SetProcessDPIAware(); } catch { }
            Application.EnableVisualStyles();
            using (var f = new SetupForm(opt))
            {
                // Abre fora da área visível só pra criar os controles, desenha e fecha
                f.StartPosition = FormStartPosition.Manual;
                f.Location = new Point(-5000, -5000);
                f.ShowInTaskbar = false;
                f.Show();
                Application.DoEvents();
                using (var bmp = new Bitmap(f.Width, f.Height))
                {
                    f.DrawToBitmap(bmp, new Rectangle(0, 0, f.Width, f.Height));
                    bmp.Save(snapshot, System.Drawing.Imaging.ImageFormat.Png);
                }
                f.Close();
            }
            return 0;
        }

        if (opt.Silent)
        {
            try
            {
                Installer.Run(opt, delegate(int p, string msg) { });
                if (opt.OpenAfter) Installer.Open(opt.Dir);
                return 0;
            }
            catch (Exception e)
            {
                Console.Error.WriteLine(e.Message);
                return 1;
            }
        }

        try { SetProcessDPIAware(); } catch { }
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        opt.OpenAfter = true;
        Application.Run(new SetupForm(opt));
        return 0;
    }
}

class Options
{
    public string Dir = Common.DefaultInstallDir;
    public bool Silent, Desktop = true, StartMenu = true, Registry = true, OpenAfter;
}

static class Installer
{
    public static void Run(Options o, Action<int, string> report)
    {
        string dir = Path.GetFullPath(o.Dir);
        report(2, "Fechando o ytbaixar se estiver aberto…");
        Common.StopRunning(dir);
        Directory.CreateDirectory(dir);

        // A interface muda de nome de arquivo a cada versão: tira a antiga pra não acumular lixo.
        // bin\ (yt-dlp, ffmpeg) e data\ (ajustes) ficam, então atualizar não baixa tudo de novo.
        string dist = Path.Combine(dir, "web", "dist");
        if (Directory.Exists(dist)) Directory.Delete(dist, true);

        string root = dir.TrimEnd('\\') + "\\";
        using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))
        using (var zip = new ZipArchive(s, ZipArchiveMode.Read))
        {
            long total = 0, done = 0;
            foreach (ZipArchiveEntry e in zip.Entries) total += e.Length;
            foreach (ZipArchiveEntry e in zip.Entries)
            {
                string dest = Path.GetFullPath(Path.Combine(dir, e.FullName.Replace('/', '\\')));
                if (!dest.StartsWith(root, StringComparison.OrdinalIgnoreCase)) continue; // nada fora da pasta
                if (e.FullName.EndsWith("/")) { Directory.CreateDirectory(dest); continue; }
                Directory.CreateDirectory(Path.GetDirectoryName(dest));
                e.ExtractToFile(dest, true);
                done += e.Length;
                report(5 + (int)(85 * done / Math.Max(1, total)), "Copiando " + e.Name);
            }
        }

        string exe = Path.Combine(dir, "ytbaixar.exe");
        string ico = Path.Combine(dir, "ytbaixar.ico");
        const string desc = "Baixar vídeos do YouTube e YouTube Music";
        if (o.StartMenu)
        {
            report(92, "Criando atalhos…");
            Common.CreateShortcut(Common.StartMenuShortcut, exe, dir, ico, desc);
        }
        if (o.Desktop) Common.CreateShortcut(Common.DesktopShortcut, exe, dir, ico, desc);
        if (o.Registry)
        {
            report(96, "Registrando em Apps instalados…");
            Common.RegisterUninstall(dir, AppInfo.Version, Common.DirSizeKb(dir));
        }
        report(100, "Pronto!");
    }

    public static void Open(string dir)
    {
        Process.Start(new ProcessStartInfo(Path.Combine(dir, "ytbaixar.exe")) { WorkingDirectory = dir });
    }
}

/* ---------------- Tela ---------------- */

class SetupForm : Form
{
    static readonly Color Bg = Color.FromArgb(18, 19, 23);
    static readonly Color Panel2 = Color.FromArgb(30, 31, 37);
    static readonly Color Muted = Color.FromArgb(160, 161, 172);
    static readonly Color Red = Color.FromArgb(255, 69, 69);
    static readonly Color Yellow = Color.FromArgb(248, 214, 91);

    readonly Options opt;
    readonly Image logo;
    Panel optionsPage, progressPage, donePage;
    TextBox pathBox;
    CheckBox desktopBox, openBox;
    Label statusLabel, doneLabel;
    FlatBar bar;
    bool installing;

    public SetupForm(Options o)
    {
        opt = o;
        using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream("logo.png"))
            logo = s != null ? Image.FromStream(s) : null;

        Text = "Instalar ytbaixar " + AppInfo.Version;
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
        AutoScaleMode = AutoScaleMode.Dpi;
        AutoScaleDimensions = new SizeF(96f, 96f);
        ClientSize = new Size(560, 400);
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Bg;
        ForeColor = Color.White;
        Font = new Font("Segoe UI", 10f);
        DoubleBuffered = true;

        var header = new HeaderPanel(logo) { Dock = DockStyle.Top, Height = 132 };
        Controls.Add(header);

        BuildOptionsPage();
        BuildProgressPage();
        BuildDonePage();
        Controls.Add(optionsPage);
        Controls.Add(progressPage);
        Controls.Add(donePage);
        ShowPage(optionsPage);
    }

    Panel NewPage()
    {
        return new Panel { Left = 0, Top = 132, Width = 560, Height = 268, BackColor = Bg };
    }

    void ShowPage(Panel p)
    {
        optionsPage.Visible = p == optionsPage;
        progressPage.Visible = p == progressPage;
        donePage.Visible = p == donePage;
    }

    static Button MakeButton(string text, bool primary)
    {
        var b = new Button
        {
            Text = text,
            FlatStyle = FlatStyle.Flat,
            BackColor = primary ? Red : Panel2,
            ForeColor = Color.White,
            Font = new Font("Segoe UI", 10f, primary ? FontStyle.Bold : FontStyle.Regular),
            Size = new Size(primary ? 130 : 110, 38),
            Cursor = Cursors.Hand,
        };
        b.FlatAppearance.BorderSize = 0;
        b.FlatAppearance.MouseOverBackColor = primary ? Color.FromArgb(255, 99, 99) : Color.FromArgb(44, 45, 52);
        return b;
    }

    static CheckBox MakeCheck(string text, int top)
    {
        return new CheckBox { Text = text, Left = 32, Top = top, Width = 480, Height = 26, Checked = true, ForeColor = Color.White, Cursor = Cursors.Hand };
    }

    void BuildOptionsPage()
    {
        optionsPage = NewPage();
        optionsPage.Controls.Add(new Label { Text = "Pasta de instalação", Left = 32, Top = 20, AutoSize = true, ForeColor = Muted });

        pathBox = new TextBox
        {
            Text = opt.Dir, Left = 32, Top = 44, Width = 376, BorderStyle = BorderStyle.FixedSingle,
            BackColor = Panel2, ForeColor = Color.White,
        };
        optionsPage.Controls.Add(pathBox);

        var browse = MakeButton("Alterar…", false);
        browse.SetBounds(418, 42, 110, 30);
        browse.Click += delegate
        {
            using (var d = new FolderBrowserDialog { Description = "Onde instalar o ytbaixar?", SelectedPath = pathBox.Text })
                if (d.ShowDialog(this) == DialogResult.OK) pathBox.Text = Path.Combine(d.SelectedPath, Common.AppName);
        };
        optionsPage.Controls.Add(browse);

        desktopBox = MakeCheck("Criar atalho na Área de Trabalho", 92);
        openBox = MakeCheck("Abrir o ytbaixar quando terminar", 120);
        optionsPage.Controls.Add(desktopBox);
        optionsPage.Controls.Add(openBox);

        optionsPage.Controls.Add(new Label
        {
            Text = "Na primeira vez que abrir, ele baixa sozinho o yt-dlp e o ffmpeg (precisa de internet).",
            Left = 32, Top = 160, Width = 496, Height = 40, ForeColor = Muted, Font = new Font("Segoe UI", 9f),
        });

        var cancel = MakeButton("Cancelar", false);
        cancel.Location = new Point(278, 212);
        cancel.Click += delegate { Close(); };
        var install = MakeButton("Instalar", true);
        install.Location = new Point(398, 212);
        install.Click += delegate { StartInstall(); };
        optionsPage.Controls.Add(cancel);
        optionsPage.Controls.Add(install);
        AcceptButton = install;
        CancelButton = cancel;
        // Foco no Instalar (senão cai no caminho e ele abre todo selecionado); só dá depois da janela aparecer
        Shown += delegate { install.Focus(); };
    }

    void BuildProgressPage()
    {
        progressPage = NewPage();
        progressPage.Controls.Add(new Label { Text = "Instalando…", Left = 32, Top = 36, AutoSize = true, Font = new Font("Segoe UI", 13f, FontStyle.Bold) });
        bar = new FlatBar { Left = 32, Top = 84, Width = 496, Height = 10, Fill = Yellow, Track = Panel2 };
        progressPage.Controls.Add(bar);
        statusLabel = new Label { Left = 32, Top = 106, Width = 496, Height = 24, ForeColor = Muted, AutoEllipsis = true };
        progressPage.Controls.Add(statusLabel);
    }

    void BuildDonePage()
    {
        donePage = NewPage();
        donePage.Controls.Add(new Label { Text = "Pronto!", Left = 32, Top = 30, AutoSize = true, Font = new Font("Segoe UI", 16f, FontStyle.Bold), ForeColor = Yellow });
        doneLabel = new Label
        {
            Text = "O ytbaixar foi instalado. Ele aparece no Menu Iniciar e dá pra remover em Configurações → Apps.",
            Left = 32, Top = 76, Width = 496, Height = 48, ForeColor = Muted,
        };
        donePage.Controls.Add(doneLabel);
        var close = MakeButton("Fechar", false);
        close.Location = new Point(278, 212);
        close.Click += delegate { Close(); };
        var open = MakeButton("Abrir ytbaixar", true);
        open.Location = new Point(398, 212);
        open.Click += delegate { Installer.Open(opt.Dir); Close(); };
        donePage.Controls.Add(close);
        donePage.Controls.Add(open);
    }

    void StartInstall()
    {
        opt.Dir = pathBox.Text.Trim();
        opt.Desktop = desktopBox.Checked;
        opt.OpenAfter = openBox.Checked;
        if (opt.Dir.Length == 0) return;
        installing = true;
        ShowPage(progressPage);

        var t = new Thread(delegate()
        {
            try
            {
                Installer.Run(opt, delegate(int p, string msg)
                {
                    BeginInvoke((MethodInvoker)delegate { bar.Value = p; statusLabel.Text = msg; });
                });
                BeginInvoke((MethodInvoker)delegate
                {
                    installing = false;
                    if (opt.OpenAfter) { Installer.Open(opt.Dir); Close(); }
                    else ShowPage(donePage);
                });
            }
            catch (Exception e)
            {
                BeginInvoke((MethodInvoker)delegate
                {
                    installing = false;
                    MessageBox.Show(this, "A instalação falhou:\n\n" + e.Message, "ytbaixar", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    ShowPage(optionsPage);
                });
            }
        });
        t.IsBackground = true;
        t.Start();
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        if (installing) e.Cancel = true; // não deixa fechar no meio da cópia
        base.OnFormClosing(e);
    }
}

// Faixa do topo: fundo escuro com brilho colorido, logo e nome
class HeaderPanel : Panel
{
    readonly Image logo;
    public HeaderPanel(Image logo) { this.logo = logo; DoubleBuffered = true; }

    protected override void OnPaint(PaintEventArgs e)
    {
        Graphics g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
        float k = g.DpiX / 96f;
        Rectangle r = ClientRectangle;

        using (var bg = new LinearGradientBrush(r, Color.FromArgb(32, 28, 30), Color.FromArgb(18, 19, 23), 90f))
            g.FillRectangle(bg, r);
        using (var path = new GraphicsPath())
        {
            path.AddEllipse(-60 * k, -90 * k, 360 * k, 260 * k);
            using (var glow = new PathGradientBrush(path) { CenterColor = Color.FromArgb(70, 248, 147, 77), SurroundColors = new[] { Color.FromArgb(0, 248, 147, 77) } })
                g.FillPath(glow, path);
        }

        if (logo != null) g.DrawImage(logo, 32 * k, 30 * k, 72 * k, 72 * k);
        using (var title = new Font("Segoe UI", 24f, FontStyle.Bold))
        using (var sub = new Font("Segoe UI", 9.5f))
        using (var red = new SolidBrush(Color.FromArgb(255, 69, 69)))
        using (var muted = new SolidBrush(Color.FromArgb(160, 161, 172)))
        {
            float x = 120 * k;
            g.DrawString("yt", title, Brushes.White, x, 30 * k);
            float w = g.MeasureString("yt", title, PointF.Empty, StringFormat.GenericTypographic).Width;
            g.DrawString("baixar", title, red, x + w + 2 * k, 30 * k);
            g.DrawString("Baixe vídeos do YouTube e YouTube Music em MP4", sub, muted, x + 2 * k, 76 * k);
        }

        var strip = new Rectangle(0, r.Bottom - (int)(4 * k), r.Width, (int)(4 * k) + 1);
        using (var lg = new LinearGradientBrush(strip, Color.Black, Color.Black, 0f))
        {
            var blend = new ColorBlend
            {
                Colors = new[] { Color.FromArgb(248, 214, 91), Color.FromArgb(248, 147, 77), Color.FromArgb(240, 90, 210) },
                Positions = new[] { 0f, 0.5f, 1f },
            };
            lg.InterpolationColors = blend;
            g.FillRectangle(lg, strip);
        }
    }
}

// Barra de progresso lisa e arredondada (a do Windows não combina com o tema escuro)
class FlatBar : Control
{
    int value;
    public Color Fill = Color.Gold, Track = Color.DimGray;
    public FlatBar() { DoubleBuffered = true; SetStyle(ControlStyles.SupportsTransparentBackColor, true); }
    public int Value { get { return value; } set { this.value = Math.Max(0, Math.Min(100, value)); Invalidate(); } }

    protected override void OnPaint(PaintEventArgs e)
    {
        Graphics g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Parent != null ? Parent.BackColor : BackColor);
        Round(g, new RectangleF(0, 0, Width - 1, Height - 1), Track);
        if (value > 0) Round(g, new RectangleF(0, 0, Math.Max(Height, (Width - 1) * value / 100f), Height - 1), Fill);
    }

    static void Round(Graphics g, RectangleF r, Color c)
    {
        float d = r.Height;
        using (var p = new GraphicsPath())
        using (var b = new SolidBrush(c))
        {
            p.AddArc(r.X, r.Y, d, d, 90, 180);
            p.AddArc(r.Right - d, r.Y, d, d, 270, 180);
            p.CloseFigure();
            g.FillPath(b, p);
        }
    }
}
