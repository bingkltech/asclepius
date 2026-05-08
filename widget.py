import tkinter as tk
import pygetwindow as gw
import webbrowser
import threading
import time

def check_browser():
    while True:
        try:
            titles = gw.getAllTitles()
            # Check if any window title contains "Asclepius Command Center"
            is_open = any("Asclepius Command Center" in t for t in titles)
            if is_open:
                print("Browser is open. Hiding widget.", flush=True)
                root.withdraw()
            else:
                print("Browser is closed. Showing widget.", flush=True)
                root.deiconify()
        except Exception as e:
            print("Error:", e, flush=True)
        time.sleep(2)

def on_double_click(event):
    webbrowser.open("http://localhost:5173")

# Initialize Tkinter
root = tk.Tk()
root.title("Asclepius Widget")
root.geometry("220x60")
root.overrideredirect(True) # No window border
root.attributes("-topmost", True)
root.attributes("-alpha", 0.95)

# Start bottom right
screen_width = root.winfo_screenwidth()
screen_height = root.winfo_screenheight()
x = screen_width - 240
y = screen_height - 120
root.geometry(f"220x60+{x}+{y}")

root.configure(bg="#09090b")

# Add a border frame
frame = tk.Frame(root, bg="#09090b", highlightbackground="#8b5cf6", highlightthickness=2)
frame.pack(fill="both", expand=True)

# Add text
label = tk.Label(frame, text="🧠 Asclepius Core Active", bg="#09090b", fg="#a78bfa", font=("Segoe UI", 10, "bold"))
label.pack(pady=(8, 0))

sub_label = tk.Label(frame, text="Double-click to open dashboard", bg="#09090b", fg="#52525b", font=("Segoe UI", 8))
sub_label.pack(side="bottom", pady=4)

# Bind double click
root.bind("<Double-Button-1>", on_double_click)
frame.bind("<Double-Button-1>", on_double_click)
label.bind("<Double-Button-1>", on_double_click)
sub_label.bind("<Double-Button-1>", on_double_click)

# Make it draggable
def start_move(event):
    root.x = event.x
    root.y = event.y

def stop_move(event):
    root.x = None
    root.y = None

def do_move(event):
    deltax = event.x - root.x
    deltay = event.y - root.y
    x = root.winfo_x() + deltax
    y = root.winfo_y() + deltay
    root.geometry(f"+{x}+{y}")

frame.bind("<ButtonPress-1>", start_move)
frame.bind("<ButtonRelease-1>", stop_move)
frame.bind("<B1-Motion>", do_move)
label.bind("<ButtonPress-1>", start_move)
label.bind("<ButtonRelease-1>", stop_move)
label.bind("<B1-Motion>", do_move)

# Start polling thread
t = threading.Thread(target=check_browser, daemon=True)
t.start()

root.mainloop()
