// Program.cs  —  120 lines, no external NuGet packages needed
using System;
using System.IO;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

class CalorieCalculatorExe : Form
{
    private WebView2 web;

    [STAThread]
    static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new CalorieCalculatorExe());
    }

    public CalorieCalculatorExe()
    {
        Text  = "Calorie Calculator";
        Width = 430;   // fits the mobile-first layout from your CSS
        Height = 880;

        web = new WebView2 { Dock = DockStyle.Fill };
        Controls.Add(web);

        web.CoreWebView2InitializationCompleted += async (_, __) =>
        {
            string appDir = AppDomain.CurrentDomain.BaseDirectory;

            // Map a fake HTTPS host → local folder so the service-worker still
            // thinks it’s in a secure context (required by sw.js).
            web.CoreWebView2.SetVirtualHostNameToFolderMapping(
                 "app.local", appDir, CoreWebView2HostResourceAccessKind.Allow);

            // Now load the PWA:
            web.CoreWebView2.Navigate("https://app.local/index.html");
        };

        web.CreateControl();
    }
}
