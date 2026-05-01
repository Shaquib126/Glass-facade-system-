import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const config: any = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 5000,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  }
};

const transporter = nodemailer.createTransport(config);
transporter.sendMail({
  from: process.env.SMTP_USER,
  to: process.env.SMTP_USER,
  subject: 'Test Email',
  text: 'This is a test email'
}).then(() => console.log('Email sent successfully'))
  .catch(err => console.error('Error sending email:', err));
