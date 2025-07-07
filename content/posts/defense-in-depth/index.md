---
title: "Defense in Depth: Castles and Moats"
date: 2025-07-06
draft: false
tags: ["homelab", "cybersecurity", "defense in depth", "secure by design", "castles", "moats"]
---

You know, I applied to two different events to talk about this topic. One said no, the other never responded. So here we are, using the power of TLS and HTML to share it anyways.

Not because I think I’m some kind of thought leader (heaven forbid), but because I believe this is something worth sharing; an understanding that took me a while to arrive at, and made cybersecurity *click*. And if it helped me, maybe it can help someone else.

---

## Preface
When I first entered the *real* tech space, you know, like beyond knowing how to change sticks of RAM, or how to open task manager and hold down `Ctrl` to make the tasks hold still, it was because of one thing:

**Minecraft**.

![Image of Minecraft Steve in the Nether](wallpaper_minecraft_nether_update_1920x1080.png)

For many, this is where it all starts. Sure, there are lots of online servers to play, but why join those when you can run your own? Download the server binary, set it up on an old laptop or something, a quick port forward and you're good to go.

For me, this was the beginning of a very rapid entrance into the world of computers:
- First I wanted to run the servers on a machine other than my PC, which meant learning Linux.
- Then I wanted to run linux on a machine that didn't need a monitor, which meant learning SSH and the terminal.
- Then I wanted a UI to manage all my servers, which introduced me to the LAMP stack via [MultiCraft](https://www.multicraft.org).
- Then I wanted to run more than just linux on my server hardware and eliminate the need to install a bunch of dependencies, so I learned about Docker and VMs.

Each step in the journey was a natural part of the progression, but I very quickly surpassed *just* running minecraft servers. That wasn't enough for me.Now, I wanted to *understand* every piece of the stack involved. Hardware, software, kernel, web pages, you name it and I probably had a long conversation with ChatGPT 3.0 about it, followed by hours of youtube tutorials.

Naturally, with server hosting and external access on my mind, networking equipment came onto my radar, and thus began my foray into the land of homelabbing.

## Building My First Digital Castle
Once I officially dove into homelabbing, there was one piece of gear I absolutely loved: **my router**.

Initially an old Mac Mini running pfSense, then a Protectli Vault running OPNSense, then a full rack-mounted Unifi stack, my joy from watching my router's firewall do it's thing was immense. It was sleek. It was powerful. It shielded me and my precious minecraft servers from the wild-west of the internet just outside my LAN. Rules, blocks, filters, port forwarding, tagging, NAT, DNS, DHCP... I spent hours fine-tuning settings and creating VLANs. Why? Because subnetting was cool, and because the internet said that was the "right way to do things." I had this vivid mental image: all my important stuff was inside the firewall, and the Bad Guys™ were stuck outside. Easy castle and moat philosophy.

So when people talked about “SSL” or “OIDC,” I nodded — those were good tools for situations outside my LAN; for other services. Inside my LAN, my firewall was the the only shield I needed. Everything else? Nice-to-have. Maybe I'd put it on my todo list and check it out someday when I was bored. My network was the main thing I was interested in.

...I'm sure you can guess where this is going.

## An Important History Lesson
![Image of Castle and Moat](https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/b510ef0d-1f06-4084-be0c-1c9612777959/dfudqtw-f80645b8-02de-4ea3-903b-fa1848d79f90.jpg/v1/fill/w_1177,h_679,q_70,strp/fantasy_castle_with_moat_and_mountains_2_0_by_prinzsunny_dfudqtw-pre.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9Mzg0MCIsInBhdGgiOiJcL2ZcL2I1MTBlZjBkLTFmMDYtNDA4NC1iZTBjLTFjOTYxMjc3Nzk1OVwvZGZ1ZHF0dy1mODA2NDViOC0wMmRlLTRlYTMtOTAzYi1mYTE4NDhkNzlmOTAuanBnIiwid2lkdGgiOiI8PTY2NTYifV1dLCJhdWQiOlsidXJuOnNlcnZpY2U6aW1hZ2Uub3BlcmF0aW9ucyJdfQ.p4ILgc8XVSIYrxfq_6zcSz7GncMxESk4DH-uBlPv904)
In a *shocking* turn of events, I wound up in Utah State University's *Information Systems - Cybersecurity* program. It was the closest degree I could find to the homelab stuff I enjoyed, so I decided I'd put up with the security classes that---at the time---I didn't much care for.

{{% lead %}}
*That's a job for **somebody else***.
{{% /lead %}}

Enter [Scott Roberts](https://sroberts.io), one of my cybersecurity professors. This guy had one of the coolest work histories of anyone I'd ever met, and lots of experience to accompany it. If nothing else, his cybersecurity classes were eye-opening, entertaining, and topped with a little intrigue.

For one of our assignments, Scott had us do a report on a book of our choosing that told a cybersecurity story. I read [*Sandworm*](https://www.goodreads.com/book/show/41436213-sandworm) by Frank Herbert, which talks about [NotPetya](https://en.wikipedia.org/wiki/NotPetya) and it's impact on the world (primarily Ukraine). If you aren't familiar with the story, I *highly* recommend checking it out. Before reading *Sandworm*, I was lukewarm on cybersecurity primarily because I didn't grasp how much of an impact a cyber event could have. Afterwards? Let me tell you, the events in that book opened my eyes to the importance of cybersecurity and gave me a real appreciation for it. Everything in our lives now is network connected and therefore hackable... there is a massive amount of gravity behind the need for good cybersecurity.

My personal interest and feeling of urgency towards the subject overall though was, admittedly, still dull as ever.

{{% lead %}}
An important and cool job, *still for **somebody else***.
{{% /lead %}}

I grew to really value Scott's experience and his input on homelab related things, especially the networking aspect, even if it were almost always from a security standpoint. Fast forward to my final semester, I'm in my last class of his, and we're learning about how to do cybersecurity from a business standpoint. Again, it made sense, but I still just wanted the technical side of things... hardware and software and networking, miss me with the business and threat stuff. Want me to flex my Docker knowledge and spin up containers? Done. We're talking about network security? Cool, let me pull up my VLAN layout to demonstrate I have a firm grasp on the topic.

I wouldn't call myself cocky, but I genuinely thought I was well ahead of the curve and could safely leave the broader security stuff to someone else. That is, until Scott dropped a metaphor that revealed my naivety...

> Scott: Network security used to be all about the firewall. Castle inside, moat around it.

**Me (in my head):** *We just have VLANs now, so it's like multiple castles with their own moats.*

> Scott: The moat wasn't all they had though, that was just one of many layers.

**Me (in my head):** *Yeah, you've got the guys with swords next, right?*

> Scott: Castles were built entirely around the premise of being secure and defensible. Even the direction the stairs rotated was designed to favor the defenders. They weren't just big *mansions*, they were *fortresses*. If attackers crossed the moat, the battle wasn't over... that's *really* where it started.

*Hold up... what?*

Then it dawned on me: the moat wasn't doing the defending... *the castle was*. The moat was just a tool used by the castle to slow, block, and redirect the enemy to a more defensible position.

This *revelation* made two things abundantly clear to me:

1. I didn't watch enough History Channel growing up
2. Cybersecurity wasn't just about maintaining the perimeter, it was about having options when the perimeter was breached

All of a sudden, the basic perimeter-based "castle and moat" design I'd learned felt wholly inadequate. This new design on the other hand, made a lot of sense. Once inside, the entire architecture was a layered nightmare for intruders. Attackers were at a disadvantage everywhere they went.

This was a strong metaphor, and Scott used it to deliver---in my opinion---two of the most important security principles I've yet to learn:
1.	**Secure by Design** – Design your systems to favor the defender from the start
2.	**Defense in Depth** – One layer of defense isn't enough, and your layers need to work together

{{< alert icon="circle-info" >}}
Obviously, this metaphor is not perfect. Siege tactics and castle building techniques do not perfectly translate to the Cybersecurity landscape, but the cyclical nature of attacks evolving and defenses being developed to keep pace, remains the same.
{{< /alert >}}

## Secure by Design: A Lesson in Architecture
At a glance, a castle might just look like a big stone mansion. In some ways, that’s true---they were expensive and extravagant dwellings. But, they were also feats of engineering designed to be imposing and intimidating fortresses. Every detail was considered with one goal: give the defender the advantage, at every stage of a siege. And all of this was planned *before the first stone was even laid*.

| Defense | Purpose |
|----------------------|-----------------------|
| Location & Elevation | Castles were often placed on hills, bluffs, or cliffs, and included towers for a reason: visibility was power. You saw the enemy coming long before they reached you, buying time to rally forces and prepare defenses. The elevation also made a rapid approach nearly impossible. |
| Archery Loopholes | Built into nearly every wall, these narrow vertical slits gave archers wide fields of fire while minimizing exposure. Their angles and placements overlapped to eliminate blind spots and deny attackers safe zones. The wall wasn’t just a barrier, it was a weapon. |
| Moats | Whether filled with water or simply dry trenches, moats served two purposes: an obstacle to keep enemies away from the walls and prevent scaling and undermining (digging under the walls), and a filter that forced attackers to go where defenders wanted them: the front gate. |

These defenses are only a few of the many features that were baked in from the start; not bolted on after the castle was built. This meant that a castle wasn’t just secure because it was big or strong, it was secure because it was designed to be defensible down to the very last detail.

This is the heart of **Secure by Design**.

## Defense in Depth: Executing Architectural Strategy
Simply building a castle with defensibility features didn't make it inherently secure. Castles got their reputation from how these features were used in conjunction with one another to control an attack.

A good castle doesn’t just try to repel enemies — it drains them. Of energy. Of time. Of morale. Multiple, coordinated layers of protection worked together to slow, trap, and weaken an attacker at every step.

| Defense | Purpose |
|----------------------|-----------------------|
| Main Gate | Moats forced attackers here, where defenders were ready to meet them. Archer fire intensified outside the gate, forcing attackers to rush in for shelter; right into the castle’s trap. The gate wasn’t just an opening... it was a kill zone. Arrows from the sides, rocks and boiling oil from above. |
| Courtyard | Breaching the gate was no small feat, but the fight wasn't necessarily over just because attackers made it in. In the courtyard, intruders were funneled into tight quarters under constant pressure, giving defenders time to regroup and pick them off from inner walls and towers in addition to the outer walls and towers. |
| Spiral Staircases | For those who managed to survive this far and made it into the castle proper, you were met with the final insult: narrow, clockwise-ascending staircases. Right-handed attackers had to swing toward the central column making close combat awkward and difficult. Meanwhile, defenders fighting downhill had reach, mobility, and gravity on their side. |

Each layer didn’t need to stop the attacker on it's own, if the enemy was able to overwhelm it then they were handed them off to the next layer. Slower, weaker, and more exposed than before.

That’s **Defense in Depth**: a system doesn't need to be perfect, it just needs to be resilient. Every layer assumes the last one might fail and is ready when it does.

## Takeaways
Alright, we get it, castles are cool. So what?

As I mentioned earlier, this metaphor doesn’t perfectly parallel the modern cybersecurity landscape. Most breaches today don’t happen at the front gate, they happen when someone unknowingly opens the back door and lets the enemy walk right in---it's called phishing. The perimeter gets skipped entirely.

In medieval times, if a castle’s outer wall fell, the battle was usually over. Quickly and brutally. Even though castles had multiple defensive layers, their strategy relied heavily on redirecting attackers into traps using walls and moats, and they were constrained by physical architecture. After all, they had to build the entire thing out of stone.

Today, things are different. Perimeters get breached all the time. If that’s your only line of defense, you’re hosed. But the digital world gives us options the physical world can only dream of. A breached perimeter doesn’t have to mean the fight is over... we can reconfigure, expand, and reinforce defenses in seconds without worrying as much about building materials or physical space.

During or after an attack isn't the time to start thinking about defense though, and that’s why the castle metaphor still matters: it demonstrates the power of layering defenses and the importance of building them in from the start. And if we were to emulate a castle’s approach to layered defense, it might look something like this:

| Castle Defense | Purpose | Modern Parallel |
|----------------|---------|-----------------|
| Location & Elevation | See and identify the enemy, inside and outside the walls | Logging, Alerts, Auditability, SIEM |
| Archery Loopholes | Overlapping coverage, external and internal defense | IDS, IPS |
| Moats and Walls | Delay or deflect attackers | Network/Device/Application firewalls |
| Main Gate | Bottleneck entry of unwanted visitors | Reverse Proxies, Authentication, MFA |
| Courtyard | Lure attackers into exposed zones | Canary Tokens, Honeypots |
| Spiral Staircases | Limit attackers' mobility in your environment | RBAC/Least Privilege |

This is by no means a comprehensive list, but it's a good starting point.

That class lecture didn’t just teach me a fun historical fact, it rewired the way I *understand* cybersecurity.

I knew passwords mattered. I knew you should patch stuff. But I thought security was perimeter-based, with everything else for the paranoid or high-stakes operations.

But it’s not. The perimeter matters, sure.

But at the end of the day?

{{% lead %}}
*It’s not the moat doing the defending, **it’s the castle***.
{{% /lead %}}

If your internal systems are soft, flat, and unaudited, it doesn’t matter how strong your firewall is. The moat might slow someone down, but once they’re across, if your architecture isn’t built for defense, you’ve lost.

## Final Thoughts
To many, this is old news. But for anyone learning cybersecurity, IT or operations, this metaphor still matters. Security is strongest when it's designed into every aspect of a system and planned from the start, not just slapped on afterwards.

And maybe, if you’ve been treating your firewall like a moat and thinking that’s enough, hopefully this has given you something to think about!

Because if your security stops at the moat, that's not much of a castle... and you could probably learn some lessons from the Empire. That's all I'm saying.

![Death Star blowing up](https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExMzJ2bHo2bWM5eWpydzg2cG1oc3liOTkwZW1zbzJ0aHhnNndzeGU4MCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/1xo9COytfPE9chS05b/giphy.gif)
