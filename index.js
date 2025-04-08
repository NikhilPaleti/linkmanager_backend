const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const User = require('./models/User'); 
const jwt = require('jsonwebtoken'); 
const Link = require('./models/Link'); 
const crypto = require('crypto'); 

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: true, // Allow all origins
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed methods
    credentials: true
}));
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('MongoDB connected'))
.catch(err => console.error(err));

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 

app.get('/', (req, res) => {
    res.send('Hello from the backend!');
});

app.post('/register', async (req, res) => {
    const { username, email, phoneno, password } = req.body;
    try {
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(400).json({ error: ` ${username} or ${email} already exists` });
        }
        const newUser = new User({ username, email, phoneno, password });
        await newUser.save();
        res.status(201).json({ message: `User registered successfully` });
    } catch (error) {
        res.status(500).json({ error: `Server error` });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
        res.json({ token });
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: error });
    }
});

// Endpoint to create a new link
app.post('/createlinks', async (req, res) => {
    const { original_link, remarks, expiry_date, owner } = req.body;
    try {
        let short_link;
        let isUnique = false;

        while (!isUnique) {
            short_link = crypto.createHash('sha256').update(owner + original_link + Date.now()).digest('hex').slice(0, 8);
            const existingLink = await Link.findOne({ short_link });
            if (!existingLink) {
                isUnique = true; // Loop till found a unique short link. Cheap maane cheap. 
            }
        }

        const newLink = new Link({ 
            original_link, 
            short_link, 
            remarks, 
            expiry_date: expiry_date || undefined, 
            owner 
        });
        await newLink.save();
        res.status(201).json({ message: 'Link created successfully', short_link });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Endpoint to fetch all links for a specific user
app.get('/links', async (req, res) => {
    const { username } = req.query; 
    try {
        const links = username ? await Link.find({ owner: username }) : await Link.find(); 
        
        const formattedLinks = links.map(link => ({
            ...link.toObject(),
            clicks: link.clicks 
        }));
        res.json(formattedLinks);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Edit a specific link entry
app.put('/link/:owner/:hash', async (req, res) => {
    const { owner, hash } = req.params;
    const updates = req.body;
    try {
        const link = await Link.findOneAndUpdate({ owner, short_link: hash }, updates, { new: true });
        if (!link) {
            return res.status(404).json({ error: 'Link not found' });
        }
        res.json(link);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Fetch a specific link by hash
app.get('/link/:owner/:hash', async (req, res) => {
    const { owner, hash } = req.params;
    try {
        const link = await Link.findOne({ owner, short_link: hash });
        if (!link) {
            return res.status(404).json({ error: 'Link not found' });
        }
        res.json(link);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Fetch a specific link by hash
app.get('/link/:hash', async (req, res) => {
    const { hash } = req.params;
    try {
        const link = await Link.findOne({ short_link: hash });
        if (!link) {
            return res.status(404).json({ error: 'Link not found' });
        }
        res.json(link);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Fetch user info
app.get('/fetchuser/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Edit user 
app.put('/edituser/:username', async (req, res) => {
    const { username } = req.params;
    const updates = req.body; 
    try {
        // Check if new username or email already exists
        if (updates.username || updates.email) {
            const existingUser = await User.findOne({
                $and: [
                    { username: { $ne: username } }, // Exclude current user
                    {
                        $or: [
                            { username: updates.username },
                            { email: updates.email }
                        ]
                    }
                ]
            });

            if (existingUser) {
                return res.status(400).json({ 
                    error: `Username/Email already exists` 
                });
            }
        }

        const user = await User.findOneAndUpdate({ username }, updates, { new: true });

        if (!user) {
            return res.status(404).json({ error: `${username} not found` });
        }
        
        if (updates.username && updates.username !== username) {
            await Link.updateMany({ owner: username }, { owner: updates.username });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete user account
app.delete('/deleteuser/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const user = await User.findOneAndDelete({ username });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        await Link.deleteMany({ owner: username });
        res.json({ message: 'User and associated links deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete one specific link
app.delete('/link/:owner/:hash', async (req, res) => {
    const { owner, hash } = req.params;
    try {
        const link = await Link.findOneAndDelete({ owner, short_link: hash });
        if (!link) {
            return res.status(404).json({ error: 'Link not found' });
        }
        res.json({ message: 'Link deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Add click data to one specific link
app.post('/editclick/:short_link/', async (req, res) => {
    const { short_link } = req.params;
    const { clickData } = req.body; 

    try {
        const link = await Link.findOne({ short_link });
        if (!link) {
            return res.status(404).json({ error: 'Link not found' });
        }

        link.clicks.push(clickData);
        await link.save();

        res.json({ message: 'Click data added successfully', clicks: link.clicks });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Experimental. Will most likely delete. 
app.get("/get-ip", (req, res) => {
    // console.log(req.ip)
    const ip = req.headers["x-forwarded-for"] || req.ip;
    res.json({ ip });
  });
