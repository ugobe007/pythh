path = '/home/ubuntu/pythh-redesign/client/src/pages/Home.tsx'
with open(path, 'r') as f:
    lines = f.readlines()

# Replace lines 288-341 (0-indexed: 287-340) with the new component
# Line 288 = index 287 (start of "Floating PYTHIA status card")
# Line 341 = index 340 (closing </div> of the panel)
start = 287  # 0-indexed line 288
end = 341    # 0-indexed line 341 (inclusive), which is the closing </div>

new_block = '''        {/* Floating PYTHIA Radar Feed */}
        <div className="hidden lg:block absolute right-8 top-1/2 -translate-y-1/2 animate-fade-in-up delay-500"
          style={{ opacity: 0, animationFillMode: "forwards" }}>
          <PythiaRadarFeed />
        </div>
'''

new_lines = lines[:start] + [new_block] + lines[end+1:]

with open(path, 'w') as f:
    f.writelines(new_lines)

print(f"Replaced lines {start+1}-{end+1} with PythiaRadarFeed component")
print(f"New total lines: {len(new_lines)}")
