# Blender --python tools/start_gui.py : start the Blender MCP bridge (blender_mcp_addon) in a GUI session.
# The add-on's own start operator needs online access + an enabled add-on; this imports its modules
# directly and runs the same start + timer sequence.
import bpy, sys, os, traceback
LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "out", "bridge.txt")
def note(s):
    with open(LOG, "a") as f: f.write(s + "\n")
addons = os.path.join(bpy.utils.resource_path('USER'), "scripts", "addons")
if addons not in sys.path: sys.path.append(addons)
def _go():
    try:
        from blender_mcp_addon import mcp_to_blender_server as srv, execute_interactive as ei
        srv.start(srv.DEFAULT_HOST, srv.DEFAULT_PORT)
        bpy.app.timers.register(ei.run, first_interval=srv.TIMER_INTERVAL_ACTIVE, persistent=True)
        note("start ok %s:%d" % (srv.DEFAULT_HOST, srv.DEFAULT_PORT))
    except Exception:
        note(traceback.format_exc())
    return None
bpy.app.timers.register(_go, first_interval=1.0)
